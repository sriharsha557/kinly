-- "Water a friend" streak save: a circle member can grant one grace day to
-- a friend who missed exactly one day, never to themselves, at most once
-- per person per week. Honesty matters - this covers the gap so the streak
-- survives on their next real log, it never fakes a completion (progress
-- is untouched; only the streak-continuation math changes).

create table streak_saves (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references profiles (id) on delete cascade,
  to_user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  saved_date date not null,
  created_at timestamptz not null default now(),
  unique (goal_id, saved_date)
);

alter table streak_saves enable row level security;

create policy "members read circle streak saves" on streak_saves
  for select using (is_circle_member(circle_id));

-- No general INSERT policy - every rule (never self, must be a circle-mate,
-- once per person per week, the streak must actually be in the single-day
-- grace window) is validated inside water_streak() instead, same pattern as
-- approve_member()/soft_delete_ask_post() elsewhere in this schema. The
-- function runs as its owner (security definer), which bypasses RLS to
-- perform the insert once every check has passed.
create function water_streak(p_goal_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  g goals;
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

  -- Only valid in the exact single-day grace window: they logged two days
  -- ago, missed yesterday, haven't logged today. Any staler and one grace
  -- day can't save it anyway (log_goal_progress only ever looks one gap
  -- day back); any fresher and there's nothing to save yet.
  if g.last_logged_date is null or g.last_logged_date <> current_date - 2 then
    raise exception 'This streak is not currently in its one-day grace window';
  end if;

  gap_date := g.last_logged_date + 1;

  insert into streak_saves (from_user_id, to_user_id, circle_id, goal_id, saved_date)
  values (auth.uid(), g.user_id, g.circle_id, p_goal_id, gap_date)
  on conflict (goal_id, saved_date) do nothing;

  insert into events (circle_id, user_id, type, payload)
  values (
    g.circle_id,
    auth.uid(),
    'streak_saved',
    jsonb_build_object(
      'to_user_id', g.user_id,
      'to_user_name', (select name from profiles where id = g.user_id),
      'goal_title', g.title
    )
  );
end;
$$;

grant execute on function water_streak(uuid) to authenticated;

-- log_goal_progress now treats a watered gap day as unbroken: if the goal
-- was last logged two days ago (not one) AND a streak_saves row covers the
-- missed day in between, the streak continues instead of resetting to 1.
create or replace function log_goal_progress(p_goal_id uuid, p_increment numeric)
returns goals
language plpgsql
as $$
declare
  g goals;
  new_progress numeric;
  new_streak integer;
  today date := current_date;
  gap_watered boolean;
begin
  select * into g from goals where id = p_goal_id;
  if g.id is null then
    raise exception 'Goal not found';
  end if;

  new_progress := least(g.target, g.progress + p_increment);

  gap_watered := g.last_logged_date = today - 2 and exists (
    select 1 from streak_saves where goal_id = p_goal_id and saved_date = today - 1
  );

  if g.last_logged_date is null or (g.last_logged_date < today - 1 and not gap_watered) then
    new_streak := 1;
  elsif g.last_logged_date = today - 1 or gap_watered then
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

alter type event_type add value if not exists 'streak_saved';
