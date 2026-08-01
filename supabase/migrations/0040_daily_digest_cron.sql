-- Schedules the daily-digest Edge Function (docs/superpowers/specs/
-- 2026-07-31-notifications-design.md). If this errors with "permission
-- denied" or "extension not available", enable pg_cron and pg_net first via
-- Dashboard -> Database -> Extensions, then re-run just the
-- `select cron.schedule(...)` statement below.
--
-- 13:30 UTC = 19:00 IST, an early-evening summary. Fixed UTC for everyone
-- rather than per-user local time, matching the approximation migration
-- 0016 already documents for check-streaks-at-risk.
--
-- This schedule must stay in sync with DIGEST_HOUR_UTC / DIGEST_MINUTE_UTC
-- in supabase/functions/daily-digest/index.ts: the function's digest window
-- is anchored to that fixed time, not computed as "now minus 24h", so if the
-- cron time and those constants ever disagree, every digest silently covers
-- the wrong window.
--
-- The net.http_post call below sends only a Content-Type header - no
-- Authorization. That only works if "Enforce JWT verification" is turned
-- OFF for the daily-digest function in the Dashboard (Edge Functions ->
-- daily-digest -> Settings). This requirement is also documented inside the
-- function file itself, but this migration is the artifact an operator
-- actually runs, so it's called out here too: if that box is left checked,
-- this cron 401s every night with no in-app symptom at all - the only sign
-- is that the digest never arrives.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-digest',
  '30 13 * * *',
  $$
  select net.http_post(
    url := 'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
