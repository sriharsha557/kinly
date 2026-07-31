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
