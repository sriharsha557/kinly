-- One-swipe mood check-in: 😊/😐/😞, one per user per circle per day.
-- Mirrors goals' circle-membership RLS pattern exactly (0001_init.sql).

create type mood_value as enum ('great', 'okay', 'tough');

create table mood_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  mood mood_value not null,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, circle_id, checkin_date)
);

alter table mood_checkins enable row level security;

create policy "members read circle mood checkins" on mood_checkins
  for select using (is_circle_member(circle_id));

create policy "members create their own mood checkins" on mood_checkins
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

-- Lets someone change their mind same-day (tap a different emoji) without
-- a second row - the client upserts on (user_id, circle_id, checkin_date).
create policy "members update their own mood checkins" on mood_checkins
  for update using (user_id = auth.uid());

-- So a mood check-in can also appear in Circle Activity, same as any other
-- event (goal completions, streaks, asks). Client inserts this only on the
-- FIRST check-in of the day, not on same-day mood changes, so flip-flopping
-- doesn't spam the feed.
alter type event_type add value if not exists 'mood_checkin';
