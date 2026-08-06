-- The showing-up rule restated in SQL for the Deno edge functions
-- (daily-digest, check-streaks-at-risk), which cannot import src/lib.
--
-- This is a second implementation of rules that live in src/lib/showingUp.ts.
-- scripts/check-showing-up-parity.mjs runs the shared fixture table against
-- both; if they drift, that fails rather than a digest silently misreporting
-- to everyone in the circle.
--
-- Weeks start Monday, matching WEEK_STARTS_ON in src/lib/periods.ts.
-- date_trunc('week', ...) is already Monday-based in Postgres, which is why
-- the two agree. Do not change one without the other.

-- date_trunc(text, p_day) below always casts p_day::timestamp explicitly.
-- date is implicitly castable to both timestamp and timestamptz, and with
-- no explicit cast Postgres resolves the overload to the preferred type,
-- timestamptz - and date_trunc(text, timestamptz) is STABLE, not IMMUTABLE,
-- because its answer depends on the session TimeZone. An incorrectly
-- IMMUTABLE function is eligible for constant-folding and caching by the
-- planner, which would silently freeze this function's answer. Casting to
-- timestamp picks the genuinely immutable overload, and date::timestamp and
-- timestamp::date are immutable too, so the whole expression is truthfully
-- immutable.
create or replace function showing_up_at(
  p_target_type text,
  p_target_count integer,
  p_target_weekdays integer[],
  p_checkins date[],
  p_day date
) returns boolean
language sql
immutable
as $$
  select case p_target_type
    when 'daily' then p_day = any(coalesce(p_checkins, '{}'::date[]))
    -- 7 - (isodow - 1) is daysRemainingInWeek, inclusive of today.
    when 'times_per_week' then
      (select count(*) from unnest(coalesce(p_checkins, '{}'::date[])) d
        where d >= date_trunc('week', p_day::timestamp)::date
          and d <  date_trunc('week', p_day::timestamp)::date + 7)
      + (7 - (extract(isodow from p_day)::int - 1)) >= coalesce(p_target_count, 0)
    -- Strictly earlier than today: a scheduled day still in progress is not
    -- a miss.
    when 'specific_weekdays' then not exists (
      select 1 from unnest(coalesce(p_target_weekdays, '{}'::int[])) as weekday
      where weekday < extract(isodow from p_day)::int
        and date_trunc('week', p_day::timestamp)::date + (weekday - 1)
            <> all(coalesce(p_checkins, '{}'::date[]))
    )
    when 'monthly' then
      (select count(*) from unnest(coalesce(p_checkins, '{}'::date[])) d
        where d >= date_trunc('month', p_day::timestamp)::date
          and d <  (date_trunc('month', p_day::timestamp) + interval '1 month')::date)
      + ((date_trunc('month', p_day::timestamp) + interval '1 month')::date - p_day)
      >= coalesce(p_target_count, 1)
    else false
  end;
$$;

-- security_invoker = true: a view otherwise runs with its OWNER's privileges
-- (Postgres 15+), and migrations run as `postgres`, so without this, RLS on
-- goals (0019) and goal_checkins (0046's "members read circle check-ins")
-- would NOT be evaluated for readers of this view - any signed-in user could
-- read every goal's showing_up status for every circle, silently undoing the
-- circle scoping the rest of this schema is careful about.
--
-- Known, accepted limitation: current_date below is evaluated in the
-- database session timezone (UTC on Supabase), while src/lib/periods.ts
-- deliberately anchors "today" to the user's LOCAL midnight. A member at, say,
-- UTC+13 will see the app (local midnight) and the daily digest / this view
-- (UTC midnight) disagree for part of each day. This is not an oversight -
-- fixing it would require per-user timezone plumbing that nothing here has
-- yet - so it is written down instead.
create or replace view goal_showing_up with (security_invoker = true) as
select g.id as goal_id, g.user_id, g.circle_id, g.area_id,
       showing_up_at(
         g.target_type, g.target_count, g.target_weekdays,
         (select array_agg(c.checkin_date) from goal_checkins c where c.goal_id = g.id),
         current_date
       ) as showing_up
from goals g
where g.status = 'active' and g.deleted_at is null;

-- No explicit grant of execute here: PUBLIC already holds EXECUTE on newly
-- created functions by default, so granting it again to authenticated/
-- service_role would add nothing. If that default ever needs restricting,
-- revoke it from PUBLIC explicitly rather than relying on a grant that never
-- did anything.
--
-- select is scoped to service_role only. The only stated consumers are the
-- daily-digest and check-streaks-at-risk edge functions, which run as the
-- service role; nothing today calls this as `authenticated`, and that grant
-- can be added once a client caller actually exists.
grant select on goal_showing_up to service_role;
