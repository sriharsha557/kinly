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
-- BEFORE RUNNING: replace <ANON_JWT> below with the project's anon key - the
-- long `eyJhbGci...` value. Find it at Dashboard -> Project Settings -> API
-- Keys -> anon/public, or copy the Authorization header the Dashboard
-- pre-fills when you create a webhook by hand. It must be the JWT-format key
-- (starting `eyJ`), NOT an `sb_publishable_...` key: notify-circle runs with
-- "Enforce JWT verification" ON, deliberately - its payload is trusted and
-- acted on, so leaving it open would let anyone push arbitrary text into any
-- circle whose id they knew.
--
-- Safe to re-run: each trigger is dropped first.

create extension if not exists pg_net;

-- events INSERT: goal completions, streaks, asks, mood check-ins, reminders,
-- and the Moments-only types. notify-circle's tier map decides which of
-- these actually earn a push; the rest return early.
drop trigger if exists notify_circle_on_events_insert on public.events;
create trigger notify_circle_on_events_insert
  after insert on public.events
  for each row
  execute function supabase_functions.http_request(
    'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON_JWT>"}',
    '{}',
    '5000'
  );

-- nudges INSERT: cheers and check-ins. This is the one whose absence was
-- first noticed - a cheer appeared in the Moments feed but never reached the
-- recipient's phone.
drop trigger if exists notify_circle_on_nudges_insert on public.nudges;
create trigger notify_circle_on_nudges_insert
  after insert on public.nudges
  for each row
  execute function supabase_functions.http_request(
    'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON_JWT>"}',
    '{}',
    '5000'
  );

-- ask_replies INSERT: notifies the author of the ask.
drop trigger if exists notify_circle_on_ask_replies_insert on public.ask_replies;
create trigger notify_circle_on_ask_replies_insert
  after insert on public.ask_replies
  for each row
  execute function supabase_functions.http_request(
    'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON_JWT>"}',
    '{}',
    '5000'
  );

-- circle_members INSERT: a join request, notifying owners and admins.
drop trigger if exists notify_circle_on_members_insert on public.circle_members;
create trigger notify_circle_on_members_insert
  after insert on public.circle_members
  for each row
  execute function supabase_functions.http_request(
    'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON_JWT>"}',
    '{}',
    '5000'
  );

-- circle_members UPDATE: an approval (pending -> active), notifying the
-- joiner. Separate from the INSERT trigger because Postgres triggers fire
-- per operation, and notify-circle distinguishes the two by inspecting
-- old_record.
drop trigger if exists notify_circle_on_members_update on public.circle_members;
create trigger notify_circle_on_members_update
  after update on public.circle_members
  for each row
  execute function supabase_functions.http_request(
    'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/notify-circle',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer <ANON_JWT>"}',
    '{}',
    '5000'
  );
