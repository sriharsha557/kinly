-- User-generated-content safety: report + block, required for App Store
-- Guideline 1.2 (apps with UGC need a way to report abusive content and
-- keep offenders from reaching a user again). Covers the app's three
-- free-text surfaces: nudge messages, ask posts, and ask replies.

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('nudge', 'ask_post', 'ask_reply', 'user')),
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

-- Write-only from the app's perspective for now - no admin dashboard exists
-- yet to review these, so there's deliberately no select policy. Reports
-- land in the table for manual review via the Supabase dashboard.
create policy "members file their own reports" on reports
  for insert with check (reporter_id = auth.uid());

create table blocked_users (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

alter table blocked_users enable row level security;

create policy "members manage their own block list" on blocked_users
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create or replace function is_blocked(p_target_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from blocked_users where blocker_id = auth.uid() and blocked_id = p_target_user
  );
$$;

grant execute on function is_blocked(uuid) to authenticated;

-- Re-scope the existing read policies to also hide content from anyone
-- the caller has blocked. Same underlying membership checks as before,
-- just narrowed further.
drop policy if exists "members read circle nudges" on nudges;
create policy "members read circle nudges" on nudges
  for select using (
    exists (select 1 from events where events.id = nudges.event_id and is_circle_member(events.circle_id))
    and not is_blocked(from_user_id)
  );

drop policy if exists "members read circle asks" on ask_posts;
create policy "members read circle asks" on ask_posts
  for select using (is_circle_member(circle_id) and not is_blocked(user_id));

drop policy if exists "members read replies on circle asks" on ask_replies;
create policy "members read replies on circle asks" on ask_replies
  for select using (
    exists (
      select 1 from ask_posts
      where ask_posts.id = ask_replies.ask_post_id and is_circle_member(ask_posts.circle_id)
    )
    and not is_blocked(user_id)
  );
