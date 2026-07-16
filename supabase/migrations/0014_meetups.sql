-- Meet Up: propose a hangout, circle-mates RSVP. Real calendar-free-time
-- detection ("everyone's free Saturday") would need device calendar
-- access this app doesn't request, so this is the honest, buildable
-- version - a lightweight proposal + RSVP instead of AI-detected availability.
create table meetups (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  title text not null,
  note text,
  proposed_date date,
  created_at timestamptz not null default now()
);

create type rsvp_status as enum ('yes', 'no', 'maybe');

create table meetup_rsvps (
  meetup_id uuid not null references meetups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  status rsvp_status not null,
  responded_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

alter table meetups enable row level security;
alter table meetup_rsvps enable row level security;

create policy "members read circle meetups" on meetups
  for select using (is_circle_member(circle_id));

create policy "members propose meetups" on meetups
  for insert with check (is_circle_member(circle_id) and created_by = auth.uid());

create policy "members read meetup rsvps" on meetup_rsvps
  for select using (
    exists (select 1 from meetups where meetups.id = meetup_rsvps.meetup_id and is_circle_member(meetups.circle_id))
  );

create policy "members rsvp for themselves" on meetup_rsvps
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from meetups where meetups.id = meetup_rsvps.meetup_id and is_circle_member(meetups.circle_id))
  );

create policy "members change their own rsvp" on meetup_rsvps
  for update using (user_id = auth.uid());
