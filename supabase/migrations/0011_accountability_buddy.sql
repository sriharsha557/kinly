-- Accountability Buddy: each member can pick one buddy per circle to keep
-- an eye on. Not required to be mutual - A picking B as a buddy doesn't
-- require B to reciprocate, keeping the flow to a single tap.
create table buddy_pairs (
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  buddy_id uuid not null references profiles (id) on delete cascade,
  paired_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

alter table buddy_pairs enable row level security;

create policy "members read circle buddy pairs" on buddy_pairs
  for select using (is_circle_member(circle_id));

create policy "members set their own buddy" on buddy_pairs
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members change their own buddy" on buddy_pairs
  for update using (user_id = auth.uid());

-- Checking in on a buddy creates a 'reminder' event attributed to *them*,
-- not the caller - the existing events insert policy only allows
-- self-attributed events, so check-ins need their own narrower carve-out.
create policy "members create check-in reminders for circle-mates" on events
  for insert with check (type = 'reminder' and is_circle_member(circle_id));
