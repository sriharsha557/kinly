-- The five Database Webhooks that make notify-circle run at all.
--
-- These existed only as prose in notify-circle/index.ts's header comment, as
-- a manual "wire these up in the Dashboard" step - and on 2026-08-01 we
-- discovered they had never been created on this project. The consequence
-- was total and silent: `select ... from information_schema.triggers where
-- action_statement ilike '%http_request%'` returned zero rows, notify-circle
-- had no invocation logs at all, and therefore NO push notification had ever
-- been delivered by this app. Every tier, every recipient rule, every mute
-- was correct code sitting behind a trigger that did not exist.
--
-- Checked in as a migration so the config is version-controlled and
-- re-creatable like the rest of the schema, instead of being a sentence in a
-- comment that a future rebuild can miss the same way.
--
-- PREREQUISITE: Database Webhooks must be enabled on the project first, via
-- Dashboard -> Database -> Webhooks -> "Enable webhooks". That one-time action
-- installs the `supabase_functions` schema and the `http_request()` function
-- these triggers call. Without it this file fails immediately with
-- `ERROR: 3F000: schema "supabase_functions" does not exist`. SQL cannot
-- enable it for you.
--
-- BEFORE RUNNING: set anon_jwt below, ONCE, on the marked line.
--
-- It must be the JWT-format anon key - the long value starting `eyJhbGci` -
-- and NOT an `sb_publishable_...` key. notify-circle runs with "Enforce JWT
-- verification" ON, deliberately: it acts on the payload it is handed, so an
-- open endpoint would let anyone push arbitrary text into any circle whose id
-- they knew. A wrong or unsubstituted value fails as a silent 401 with
-- nothing visible in the app, so verify with the query at the bottom.
--
-- Where to find it: Dashboard -> Database -> Webhooks -> Create a new hook.
-- The form pre-fills the correct Authorization header; copy the part after
-- "Bearer " and cancel out of the form. (Project Settings -> API Keys ->
-- Legacy API keys -> anon/public is the same value.)
--
-- This file previously asked for the same substitution in five places, and
-- the first run missed all five - hence the single variable below.
--
-- Safe to re-run: each trigger is dropped first.

create extension if not exists pg_net;

do $$
declare
  -- ↓↓↓ THE ONE LINE TO EDIT ↓↓↓
  anon_jwt text := '<ANON_JWT>';
  -- ↑↑↑ THE ONE LINE TO EDIT ↑↑↑

  fn_url   text := 'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle';
  headers  text;
  hook     record;
begin
  if anon_jwt = '<ANON_JWT>' or anon_jwt not like 'eyJ%' then
    raise exception
      'anon_jwt is not set to a JWT-format anon key (it must start with eyJ). Every webhook would 401 silently.';
  end if;

  -- Reject the service_role key explicitly. It is also a JWT starting `eyJ`,
  -- so a shape check alone waves it through - and it very nearly did: the
  -- Dashboard's key page lists both, and they are indistinguishable by eye.
  --
  -- Using it here would be genuinely dangerous, not merely wrong. Trigger
  -- definitions are stored as plain text and readable via
  -- information_schema.triggers, so this would write the one credential that
  -- bypasses every RLS policy into a queryable table - and into this file,
  -- which is committed to git.
  if convert_from(
       decode(
         -- base64url -> base64, padded to a multiple of 4
         rpad(translate(split_part(anon_jwt, '.', 2), '-_', '+/'),
              ((length(split_part(anon_jwt, '.', 2)) + 3) / 4) * 4, '='),
         'base64'
       ), 'utf8'
     )::jsonb ->> 'role' is distinct from 'anon'
  then
    raise exception
      'anon_jwt is not an anon key - its role claim is %. Use the key labelled anon/public, never service_role.',
      coalesce(
        convert_from(decode(rpad(translate(split_part(anon_jwt, '.', 2), '-_', '+/'),
          ((length(split_part(anon_jwt, '.', 2)) + 3) / 4) * 4, '='), 'base64'), 'utf8')::jsonb ->> 'role',
        'unreadable');
  end if;

  headers := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', anon_jwt);

  -- Each row is one webhook. notify-circle's tier map decides which of these
  -- actually earn a push notification; the rest return early and appear in
  -- the Moments feed only.
  for hook in
    select * from (values
      -- Goal completions, streaks, asks, mood check-ins, streak reminders,
      -- and the Moments-only types.
      ('notify_circle_on_events_insert',      'events',         'insert'),
      -- Cheers and check-ins. The absence of this one is what was first
      -- noticed: a cheer reached the Moments feed but never the phone.
      ('notify_circle_on_nudges_insert',      'nudges',         'insert'),
      -- Notifies the author of the ask.
      ('notify_circle_on_ask_replies_insert', 'ask_replies',    'insert'),
      -- A join request, notifying owners and admins.
      ('notify_circle_on_members_insert',     'circle_members', 'insert'),
      -- An approval (pending -> active), notifying the joiner. Separate from
      -- the insert above because triggers fire per operation, and
      -- notify-circle tells the two apart by inspecting old_record.
      ('notify_circle_on_members_update',     'circle_members', 'update')
    ) as t(trigger_name, table_name, op)
  loop
    execute format('drop trigger if exists %I on public.%I', hook.trigger_name, hook.table_name);
    execute format(
      'create trigger %I after %s on public.%I for each row
         execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
      hook.trigger_name, hook.op, hook.table_name,
      fn_url, 'POST', headers, '{}', '5000'
    );
  end loop;
end $$;

-- Verify: expect 5 rows, every placeholder_left false and every has_real_jwt
-- true. Anything else means the pushes will 401 without saying so.
select trigger_name,
       action_statement ilike '%<ANON_JWT>%' as placeholder_left,
       action_statement ilike '%Bearer eyJ%' as has_real_jwt
from information_schema.triggers
where trigger_schema = 'public'
  and action_statement ilike '%http_request%'
order by trigger_name;
