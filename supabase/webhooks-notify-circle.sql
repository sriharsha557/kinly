-- Database Webhooks for the notify-circle Edge Function, as reproducible
-- SQL instead of dashboard clicks. Supabase's "Database Webhooks" UI
-- creates exactly these triggers under the hood (pg_net-backed
-- supabase_functions.http_request), so running this in the SQL editor is
-- equivalent to adding the five webhooks by hand — do one or the other,
-- not both, or every insert will fan out twice.
--
-- NOT a numbered migration on purpose: it contains two per-project values
-- that must be filled in first. Replace before running:
--   YOUR_PROJECT_REF  -> the ref in your Supabase URL (https://<ref>.supabase.co)
--   YOUR_ANON_KEY     -> Settings -> API -> anon public key
-- (The anon key is public — it's shipped in the app binary — so having it
-- here is not a secret leak; the function itself uses its service-role env
-- var, the header only gets the request past the platform's JWT gate.)
--
-- Requires the pg_net extension (Database -> Extensions -> pg_net), which
-- the Webhooks UI would also enable.

create or replace trigger notify_circle_on_event
after insert on public.events
for each row
execute function supabase_functions.http_request(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-circle',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '5000'
);

create or replace trigger notify_circle_on_nudge
after insert on public.nudges
for each row
execute function supabase_functions.http_request(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-circle',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '5000'
);

create or replace trigger notify_circle_on_ask_reply
after insert on public.ask_replies
for each row
execute function supabase_functions.http_request(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-circle',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '5000'
);

-- Join requests (INSERT status='pending') and approvals (UPDATE
-- pending -> active) — see notify-circle's circle_members branches.
create or replace trigger notify_circle_on_member_insert
after insert on public.circle_members
for each row
execute function supabase_functions.http_request(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-circle',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '5000'
);

create or replace trigger notify_circle_on_member_update
after update on public.circle_members
for each row
execute function supabase_functions.http_request(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-circle',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}',
  '{}',
  '5000'
);
