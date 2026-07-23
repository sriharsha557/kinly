-- Attach an optional reason to a watered streak day ("Life Happens" tags),
-- so the circle feed can say "Harsha took a travel day" instead of a bare
-- "watered their streak" - reframing a missed day as understood rather than
-- failed, without building a separate Grace Day/Vacation system on top of
-- the watering mechanic that already exists.

alter table streak_saves add column if not exists reason text
  check (reason in ('travel', 'sick', 'family', 'work', 'rest', 'other'));

-- Postgres identifies functions by name + parameter types, so adding a
-- parameter creates a new overload rather than replacing the old one -
-- drop the single-arg version explicitly so there's exactly one
-- water_streak to call and maintain.
drop function if exists water_streak(uuid);

-- Same as the water_streak() defined in 0025_streak_saves.sql, with a
-- p_reason parameter threaded through - every existing check (never self,
-- must be a circle-mate, once per person per week, single-day grace
-- window) is preserved exactly as written there.
create or replace function water_streak(p_goal_id uuid, p_reason text default null)
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

  if g.last_logged_date is null or g.last_logged_date <> current_date - 2 then
    raise exception 'This streak is not currently in its one-day grace window';
  end if;

  gap_date := g.last_logged_date + 1;

  insert into streak_saves (from_user_id, to_user_id, circle_id, goal_id, saved_date, reason)
  values (auth.uid(), g.user_id, g.circle_id, p_goal_id, gap_date, p_reason)
  on conflict (goal_id, saved_date) do nothing;

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
