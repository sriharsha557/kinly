-- Schedules the check-streaks-at-risk Edge Function to run daily. If this
-- errors with "permission denied" or "extension not available", enable
-- pg_cron and pg_net first via Dashboard -> Database -> Extensions, then
-- re-run just the `select cron.schedule(...)` statement below.
--
-- Runs at 18:00 UTC daily - an approximation, not per-user timezone-aware
-- (goals.last_logged_date has no timezone attached to it).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'check-streaks-at-risk-daily',
  '0 18 * * *',
  $$
  select net.http_post(
    url := 'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/check-streaks-at-risk',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
