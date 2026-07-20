-- Fixes a race in useSubmitMoodCheckin: the events write was read-then-
-- insert/update (SELECT for an existing today's mood_checkin event, then
-- INSERT or UPDATE based on the result) with no DB-level uniqueness
-- guard - two concurrent submissions (double-tap, two devices) could both
-- miss the existing row in their own SELECT and each insert a duplicate
-- event. mood_checkins itself was already safe (a real unique constraint
-- backs its upsert); events wasn't. Moves the whole read-modify-write into
-- a single atomic RPC instead of two round-trips from the client.

-- Mirrors mood_checkins.checkin_date, but only meaningful for
-- type='mood_checkin' rows - nullable, unused by every other event type.
alter table events add column if not exists checkin_date date;

-- A partial unique index (scoped to mood_checkin rows only) is what makes
-- the upsert in submit_mood_checkin() below atomic - Postgres enforces
-- "one mood_checkin event per user/circle/day" at the constraint level,
-- not in application code that can race.
create unique index if not exists events_mood_checkin_unique_idx
  on events (circle_id, user_id, checkin_date)
  where type = 'mood_checkin';

create or replace function submit_mood_checkin(p_circle_id uuid, p_mood mood_value, p_tags text[] default '{}')
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  today date := current_date;
begin
  if not is_circle_member(p_circle_id) then
    raise exception 'not a member of this circle';
  end if;

  insert into mood_checkins (user_id, circle_id, mood, tags, checkin_date)
  values (auth.uid(), p_circle_id, p_mood, p_tags, today)
  on conflict (user_id, circle_id, checkin_date)
  do update set mood = excluded.mood, tags = excluded.tags;

  insert into events (circle_id, user_id, type, payload, checkin_date)
  values (p_circle_id, auth.uid(), 'mood_checkin', jsonb_build_object('mood', p_mood), today)
  on conflict (circle_id, user_id, checkin_date) where type = 'mood_checkin'
  do update set payload = excluded.payload;
end;
$$;

grant execute on function submit_mood_checkin(uuid, mood_value, text[]) to authenticated;
