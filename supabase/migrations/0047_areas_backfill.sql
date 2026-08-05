-- Backfill: map existing goals onto Areas, resolve the rows that violate the
-- new one-active-goal-per-Area rule, and enable a starting set of Areas per
-- circle. Nothing is deleted. Anything that cannot be mapped cleanly is
-- flagged needs_review rather than dropped.

-- 1. Map the old five-pillar category onto the new eight Areas.
update goals g
set area_id = a.id
from areas a
where g.deleted_at is null
  and g.area_id is null
  and a.key = case g.category
    when 'health'        then 'health'
    when 'wealth'        then 'finance'
    when 'ideas'         then 'creativity'
    when 'learning'      then 'learning'
    when 'relationships' then 'family'
  end;

-- 2. Goals with no category, or 'misc', have no honest mapping. Archive them
-- for review instead of guessing - a wrong Area is worse than a flagged one.
insert into goal_history (
  goal_id, circle_id, user_id, area_id, title, target_type,
  started_at, ended_at, best_streak, ended_reason, needs_review
)
select g.id, g.circle_id, g.user_id, null, g.title, null,
       g.created_at::date, current_date, g.streak_count, 'migration', true
from goals g
where g.deleted_at is null and g.area_id is null and g.status = 'active';

update goals
set status = 'ended', ended_at = current_date, ended_reason = 'migration'
where deleted_at is null and area_id is null and status = 'active';

-- 3. One active goal per (user, area). Keep the one the person actually
-- engaged with most recently; archive the rest for review. Ordering puts
-- nulls last so a never-logged goal never wins over a logged one.
with ranked as (
  select id,
         row_number() over (
           partition by circle_id, user_id, area_id
           order by last_logged_date desc nulls last, created_at desc
         ) as rank
  from goals
  where deleted_at is null and status = 'active' and area_id is not null
),
overflow as (
  select g.* from goals g join ranked r on r.id = g.id where r.rank > 1
)
insert into goal_history (
  goal_id, circle_id, user_id, area_id, title, target_type,
  started_at, ended_at, best_streak, ended_reason, needs_review
)
select o.id, o.circle_id, o.user_id, o.area_id, o.title, 'daily',
       o.created_at::date, current_date, o.streak_count, 'migration', true
from overflow o;

update goals
set status = 'ended', ended_at = current_date, ended_reason = 'migration'
where id in (
  select id from (
    select id, row_number() over (
      partition by circle_id, user_id, area_id
      order by last_logged_date desc nulls last, created_at desc
    ) as rank
    from goals
    where deleted_at is null and status = 'active' and area_id is not null
  ) r where r.rank > 1
);

-- 4. Every surviving goal becomes daily. started_at is deliberately left
-- alone here - 0046 already backfilled it from created_at, and that is each
-- goal's real origin date. Re-stamping it to today would destroy that history
-- for no benefit: nothing in the app reads started_at to judge showing-up
-- (isShowingUp never looks at it), and streak() reads only the check-in
-- ledger, which starts empty for every migrated goal regardless of the date
-- stored here.
update goals
set target_type = 'daily'
where deleted_at is null and status = 'active' and target_type is null;

-- 5. Seed each circle with Health, Learning and Finance, plus any Area its
-- members are already using.
insert into circle_areas (circle_id, area_id)
select c.id, a.id
from circles c cross join areas a
where a.key in ('health', 'learning', 'finance')
on conflict do nothing;

insert into circle_areas (circle_id, area_id)
select distinct g.circle_id, g.area_id
from goals g
where g.area_id is not null and g.status = 'active'
on conflict do nothing;
