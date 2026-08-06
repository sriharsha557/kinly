-- Backfill: map existing goals onto Areas, resolve the rows that violate the
-- new one-active-goal-per-Area rule, and enable a starting set of Areas per
-- circle. Nothing is deleted. Anything that cannot be mapped cleanly is
-- flagged needs_review rather than dropped.
--
-- Soft-deleted goals (deleted_at is not null) are deliberately left alone by
-- every statement below - they keep status='active' with no area and no
-- cadence from 0046's default. That is safe today (the one-active-per-area
-- index already excludes them), but a future undelete path must give them an
-- area and cadence before putting them back in front of a member.
--
-- The whole file runs as one transaction: several steps are an archive
-- insert into goal_history immediately followed by a separate update that
-- marks the same goals ended. If the script died between the two, a goal
-- would be left archived-but-still-active, and simply re-running the script
-- would not repair that - it would insert a second, duplicate history row.
-- An explicit begin/commit makes each archive-then-end pair atomic with the
-- rest of the migration.
begin;

-- Guard: step 1 only works if every one of these five keys exists in areas.
-- If one were ever missing, the case expression below would match nothing
-- for goals in that category, step 2 would then read them as "no honest
-- mapping" and mass-archive them - a silent, destructive failure with no
-- error to signal it. All five exist in 0046 today; this just makes a future
-- change to the area catalog fail loudly instead of quietly eating goals.
do $$
begin
  if (select count(*) from areas
      where key in ('health', 'finance', 'creativity', 'learning', 'family')) <> 5 then
    raise exception 'Area catalog is incomplete; backfill would silently archive every mapped goal';
  end if;
end $$;

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
--
-- `id desc` is appended to both this order-by and the matching one in the
-- update below purely as a tiebreaker. Without it, whenever two goals in the
-- same (circle_id, user_id, area_id) partition tie on both
-- last_logged_date and created_at - which happens for any goals with no
-- check-ins yet that were inserted in the same transaction - row_number()
-- gives Postgres no guarantee that this insert and the later update agree on
-- which row is rank 1. They could disagree: this statement archives goal X
-- while the update below ends goal Y instead, leaving X archived but still
-- active, and ending Y with no history row at all - its title and
-- best_streak gone for good. goals.id is the primary key, so ordering by it
-- last makes the ranking total and guarantees both statements rank
-- identically.
with ranked as (
  select id,
         row_number() over (
           partition by circle_id, user_id, area_id
           order by last_logged_date desc nulls last, created_at desc, id desc
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
-- target_type is null, not 'daily': these goals are ended by this step and
-- so are skipped by step 4's daily backfill below. In `goals` they keep
-- target_type is null, and the archive must match the goal it is recording
-- rather than invent a cadence the goal never actually had - the history UI
-- reads this column back.
select o.id, o.circle_id, o.user_id, o.area_id, o.title, null,
       o.created_at::date, current_date, o.streak_count, 'migration', true
from overflow o;

update goals
set status = 'ended', ended_at = current_date, ended_reason = 'migration'
where id in (
  select id from (
    select id, row_number() over (
      partition by circle_id, user_id, area_id
      order by last_logged_date desc nulls last, created_at desc, id desc
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
-- members are already using. Soft-deleted circles are excluded - there is no
-- point turning on Areas for a circle nobody can read anymore.
insert into circle_areas (circle_id, area_id)
select c.id, a.id
from circles c cross join areas a
where a.key in ('health', 'learning', 'finance')
  and c.deleted_at is null
on conflict do nothing;

insert into circle_areas (circle_id, area_id)
select distinct g.circle_id, g.area_id
from goals g
where g.area_id is not null and g.status = 'active'
on conflict do nothing;

commit;
