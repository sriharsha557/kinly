-- The two remaining server-side writers move onto the check-in ledger.
--
-- 0046 made goal_checkins the record of a member showing up, and every
-- client feature now counts rows there: the garden, the streak numbers, the
-- profile stats, the weekly recap, Circle Today's "needs attention" list.
-- goals.streak_count and goals.last_logged_date are what those features used
-- to read, and nothing reads them any more.
--
-- sync_step_goal() and water_streak() never got that message. Both still do
-- their real work by writing goals.streak_count. Since nothing reads that
-- column, both functions are currently invisible: they succeed, they return
-- without error, and the app looks exactly as it did before they ran. This
-- migration points them at the ledger instead.
--
-- Neither column is dropped here. check-streaks-at-risk (0016) and
-- log_goal_progress (0007/0025) still write and read them for legacy numeric
-- goals; removing the columns is a later plan's job, not this one's.

-- ---------------------------------------------------------------------------
-- sync_step_goal: crossing the threshold is a check-in
-- ---------------------------------------------------------------------------
-- Same signature and return type as 0033 - useSyncStepGoal calls this by
-- name with p_goal_id / p_steps and reads back a whole goals row, so both
-- are fixed points.
--
-- What changes is where "the device hit today's target" gets recorded. It
-- used to be a streak number this function computed itself. Now it is one
-- row in goal_checkins for today, and the streak is counted from the ledger
-- like every other commitment's. Without that insert a member could walk
-- 12,000 steps every day for a month and their garden would stay bare,
-- because the only trace of it would be a column nothing reads.
--
-- progress and last_synced_date are still written: the step card shows
-- today's count against the threshold, and last_synced_date is what tells
-- this function whether a resync is same-day (never go backwards) or a new
-- day (start today's count fresh). last_logged_date keeps being written too,
-- unchanged from 0033 - the streak-at-risk cron still filters on it, and
-- silently dropping step goals out of that cron is not this migration's
-- business.
create or replace function sync_step_goal(p_goal_id uuid, p_steps integer)
returns goals
language plpgsql
security definer set search_path = public
as $$
declare
  g goals;
  today date := current_date;
  new_progress numeric;
  target_reached_now boolean;
begin
  select * into g from goals where id = p_goal_id and user_id = auth.uid();
  if g.id is null then
    raise exception 'Goal not found or not owned by caller';
  end if;
  if g.goal_source <> 'health_steps' then
    raise exception 'Goal is not Health Connect-tracked';
  end if;

  -- New day: start today's count fresh. Same day: a device resync should
  -- never make progress go backwards.
  if g.last_synced_date is distinct from today then
    new_progress := least(g.target, greatest(0, p_steps));
  else
    new_progress := greatest(g.progress, least(g.target, greatest(0, p_steps)));
  end if;

  -- `g.target is not null` is stated rather than left to three-valued logic.
  -- 0049 made goals.target nullable, and a bare `new_progress >= g.target`
  -- is NULL - not false - for a step goal with no threshold set. That reads
  -- as false in the `if` below either way, but a NULL boolean assigned to a
  -- variable named target_reached_now is a trap for the next reader.
  target_reached_now := g.target is not null and new_progress >= g.target;

  if target_reached_now then
    -- on conflict do nothing, not upsert: goal_checkins is append-only and
    -- has no UPDATE policy (0046). A device that foregrounds five times
    -- after the threshold is crossed must produce exactly one check-in for
    -- today, and the unique (goal_id, checkin_date) constraint is what makes
    -- that true. user_id is g.user_id, which the ownership check above has
    -- already established equals auth.uid().
    insert into goal_checkins (goal_id, user_id, checkin_date)
    values (p_goal_id, g.user_id, today)
    on conflict (goal_id, checkin_date) do nothing;
  end if;

  update goals
  set progress = new_progress,
      last_synced_date = today,
      last_logged_date = today
  where id = p_goal_id
  returning * into g;

  return g;
end;
$$;

grant execute on function sync_step_goal(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- water_streak: a saved day is a real day in the ledger
-- ---------------------------------------------------------------------------
-- Same signature and return type as 0035 (p_goal_id uuid, p_reason text
-- default null) returns void - useWaterStreak passes both by name.
--
-- The counterfactual here is the sharper one. Watering used to work by
-- teaching log_goal_progress to skip over the gap day when it recomputed
-- streak_count. Under the ledger nothing recomputes streak_count and nothing
-- reads it, so a water with no ledger insert would do this: the friend taps
-- "water", the event lands in the feed, the streak_saves row is written, and
-- the streak on screen does not move - and when the person themselves checks
-- in tomorrow, the ledger still shows a missing day, so their streak restarts
-- at one. The save would appear to have worked and then quietly vanish. The
-- one thing in this app you do FOR someone else has to actually hold.
--
-- So the save writes the missed day into goal_checkins, on behalf of the
-- goal's owner. A member cannot do that themselves - 0046's insert policy
-- requires user_id = auth.uid() AND checkin_date <= current_date, and this is
-- someone else's user_id. security definer is what makes it possible, and
-- every rule below is why it is safe: never yourself, must be a circle-mate,
-- once per person per week, and only for the one specific day that is
-- actually in the grace window. The date written is always current_date - 1,
-- never a date the caller supplies.
--
-- The grace window is now read from the ledger rather than from
-- goals.last_logged_date. That is the same rule - they showed up two days
-- ago, missed yesterday, have not shown up today - measured against the
-- column that is actually being written. Left on last_logged_date, this
-- check would reject nearly every real save: src/lib/needsAttention.ts
-- decides whether to even offer the "water" action from the ledger's last
-- check-in date, so the client would offer it and the server would refuse.
create or replace function water_streak(p_goal_id uuid, p_reason text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  g goals;
  last_checkin date;
  gap_date date;
begin
  select * into g from goals where id = p_goal_id;
  if g.id is null then
    raise exception 'Goal not found';
  end if;

  if g.user_id = auth.uid() then
    raise exception 'You cannot water your own streak';
  end if;

  if not is_circle_member(g.circle_id) then
    raise exception 'Not a member of this circle';
  end if;

  if exists (
    select 1 from streak_saves
    where from_user_id = auth.uid() and to_user_id = g.user_id
      and created_at > now() - interval '7 days'
  ) then
    raise exception 'You can only water this friend''s streak once a week';
  end if;

  select max(checkin_date) into last_checkin
  from goal_checkins where goal_id = p_goal_id;

  -- Only valid in the exact single-day grace window: they checked in two
  -- days ago, missed yesterday, haven't checked in today. Any staler and one
  -- grace day cannot bridge the gap anyway; any fresher and there is nothing
  -- to save yet. max() covering today is what makes "haven't checked in
  -- today" part of this test - a check-in today would make last_checkin
  -- current_date, not current_date - 2.
  if last_checkin is null or last_checkin <> current_date - 2 then
    raise exception 'This streak is not currently in its one-day grace window';
  end if;

  gap_date := last_checkin + 1;

  insert into streak_saves (from_user_id, to_user_id, circle_id, goal_id, saved_date, reason)
  values (auth.uid(), g.user_id, g.circle_id, p_goal_id, gap_date, p_reason)
  on conflict (goal_id, saved_date) do nothing;

  -- The row that makes the save real. user_id is the goal's OWNER, not the
  -- caller - this is their day being covered, and every reader of the ledger
  -- attributes check-ins by user_id. streak_saves above keeps the record of
  -- who gave it and why, so the gift stays attributable even though the
  -- check-in reads as theirs.
  insert into goal_checkins (goal_id, user_id, checkin_date)
  values (p_goal_id, g.user_id, gap_date)
  on conflict (goal_id, checkin_date) do nothing;

  insert into events (circle_id, user_id, type, payload)
  values (
    g.circle_id,
    auth.uid(),
    'streak_saved',
    jsonb_build_object(
      'to_user_id', g.user_id,
      'to_user_name', (select name from profiles where id = g.user_id),
      'goal_title', g.title,
      'reason', p_reason
    )
  );
end;
$$;

grant execute on function water_streak(uuid, text) to authenticated;
