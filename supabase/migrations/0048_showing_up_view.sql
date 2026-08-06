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
        where d >= date_trunc('week', p_day)::date
          and d <  date_trunc('week', p_day)::date + 7)
      + (7 - (extract(isodow from p_day)::int - 1)) >= coalesce(p_target_count, 0)
    -- Strictly earlier than today: a scheduled day still in progress is not
    -- a miss.
    when 'specific_weekdays' then not exists (
      select 1 from unnest(coalesce(p_target_weekdays, '{}'::int[])) as weekday
      where weekday < extract(isodow from p_day)::int
        and date_trunc('week', p_day)::date + (weekday - 1)
            <> all(coalesce(p_checkins, '{}'::date[]))
    )
    when 'monthly' then
      (select count(*) from unnest(coalesce(p_checkins, '{}'::date[])) d
        where d >= date_trunc('month', p_day)::date
          and d <  (date_trunc('month', p_day) + interval '1 month')::date)
      + ((date_trunc('month', p_day) + interval '1 month')::date - p_day)
      >= coalesce(p_target_count, 1)
    else false
  end;
$$;

create or replace view goal_showing_up as
select g.id as goal_id, g.user_id, g.circle_id, g.area_id,
       showing_up_at(
         g.target_type, g.target_count, g.target_weekdays,
         (select array_agg(c.checkin_date) from goal_checkins c where c.goal_id = g.id),
         current_date
       ) as showing_up
from goals g
where g.status = 'active' and g.deleted_at is null;

grant execute on function showing_up_at(text, integer, integer[], date[], date) to authenticated, service_role;
grant select on goal_showing_up to authenticated, service_role;
