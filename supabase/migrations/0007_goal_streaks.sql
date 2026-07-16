-- Streak tracking: a streak counts consecutive calendar days a goal was
-- logged on, not just cumulative progress. last_logged_date is the anchor;
-- log_goal_progress does the day-math atomically so concurrent taps from a
-- device can't race two different streak computations against each other.

alter table goals add column last_logged_date date;

create function log_goal_progress(p_goal_id uuid, p_increment numeric)
returns goals
language plpgsql
as $$
declare
  g goals;
  new_progress numeric;
  new_streak integer;
  today date := current_date;
begin
  select * into g from goals where id = p_goal_id;
  if g.id is null then
    raise exception 'Goal not found';
  end if;

  new_progress := least(g.target, g.progress + p_increment);

  if g.last_logged_date is null or g.last_logged_date < today - 1 then
    new_streak := 1;
  elsif g.last_logged_date = today - 1 then
    new_streak := g.streak_count + 1;
  else
    new_streak := g.streak_count;
  end if;

  update goals
  set progress = new_progress, streak_count = new_streak, last_logged_date = today
  where id = p_goal_id
  returning * into g;

  return g;
end;
$$;

grant execute on function log_goal_progress(uuid, numeric) to authenticated;
