-- Circle Challenges never celebrated hitting their target - add the event
-- type so completing one flows through the same events/notify-circle
-- pipeline every other celebration already uses.
alter type event_type add value if not exists 'challenge_completed';

-- Per-category notification mute ("mute a category per Circle" - PRD
-- section 7). One row per (user, circle, category) that's muted; absence
-- of a row means notifications for that category are on, by design, so a
-- brand new user starts with everything enabled.
create table notification_mutes (
  user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, circle_id, category)
);

alter table notification_mutes enable row level security;

create policy "users manage their own notification mutes" on notification_mutes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
