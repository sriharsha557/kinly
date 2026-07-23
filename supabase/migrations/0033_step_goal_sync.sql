-- Health-Connect-synced step goals. Unlike manually logged goals (progress
-- accumulates lifetime toward target and stays "done" once reached), a step
-- goal represents *today's* step count: progress resets to 0 each new day
-- and re-fills as the device reports fresh totals, so "Completed" means
-- "hit today's target," not "hit it once, ever."

alter table goals add column if not exists goal_source text not null default 'manual'
  check (goal_source in ('manual', 'health_steps'));
alter table goals add column if not exists last_synced_date date;

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
  already_credited_today boolean;
  completed_yesterday boolean;
  new_streak integer;
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

  target_reached_now := new_progress >= g.target;
  already_credited_today := g.last_synced_date = today and g.progress >= g.target;
  completed_yesterday := g.last_synced_date = today - 1 and g.progress >= g.target;

  if target_reached_now and not already_credited_today then
    new_streak := case when completed_yesterday then g.streak_count + 1 else 1 end;
  elsif not target_reached_now and (g.last_synced_date is null or g.last_synced_date < today - 1) then
    -- A full day (or more) went by with no completion in between.
    new_streak := 0;
  else
    new_streak := g.streak_count;
  end if;

  update goals
  set progress = new_progress,
      streak_count = new_streak,
      last_synced_date = today,
      last_logged_date = today
  where id = p_goal_id
  returning * into g;

  return g;
end;
$$;

grant execute on function sync_step_goal(uuid, integer) to authenticated;
