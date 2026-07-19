-- Minimal analytics log - no analytics SDK exists in this app, and this is
-- the one thing worth measuring right now: % of circles reaching 3+
-- members within 48h of creation (Feature 2's cold-start success metric).
-- Insert-only from the client; queried ad-hoc via the SQL editor, not
-- surfaced anywhere in-app, so there's no SELECT policy at all - RLS
-- enabled with only an INSERT policy means nothing but the service role
-- can read it back.
--
-- actor_user_id (who performed the action) is separate from subject_user_id
-- (who the event is about) - member_joined is logged from approve_member's
-- caller (the owner/admin approving), not the joining member's own session,
-- so actor != subject there. circle_created has no meaningful subject.
--
-- Convention: the circle owner is implicitly member #1 at circle_created
-- time (no separate member_joined logged for them) - a circle reaches 3
-- members when circle_created has 2 subsequent member_joined rows for the
-- same circle_id within 48h.
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in ('circle_created', 'member_joined')),
  actor_user_id uuid not null default auth.uid() references profiles (id) on delete cascade,
  subject_user_id uuid references profiles (id) on delete cascade,
  circle_id uuid references circles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table analytics_events enable row level security;

create policy "authenticated users log their own analytics actions" on analytics_events
  for insert with check (actor_user_id = auth.uid());

grant insert on analytics_events to authenticated;
