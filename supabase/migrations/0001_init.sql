-- Kinly MVP schema: profiles, circles, goals, events, nudges, ask posts, achievements.
-- RLS is circle-scoped throughout: a row is visible only to members of its circle.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users; created via trigger on signup)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  avatar text,
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- circles + membership (roles: owner, admin, member)
-- ---------------------------------------------------------------------------
create table circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles (id) on delete cascade,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  created_at timestamptz not null default now()
);

create type circle_role as enum ('owner', 'admin', 'member');

create table circle_members (
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create function enforce_circle_member_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from circle_members where circle_id = new.circle_id) >= 10 then
    raise exception 'Circle already has the maximum of 10 members';
  end if;
  return new;
end;
$$;

create trigger circle_member_limit
  before insert on circle_members
  for each row execute procedure enforce_circle_member_limit();

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  title text not null,
  target numeric not null,
  progress numeric not null default 0,
  streak_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events (activity feed) + nudges
-- ---------------------------------------------------------------------------
create type event_type as enum ('goal_completed', 'streak', 'reminder', 'ask');

create table events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  type event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create type nudge_kind as enum ('cheer', 'water', 'walk', 'workout', 'keep_going', 'streak');

create table nudges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  from_user_id uuid not null references profiles (id) on delete cascade,
  kind nudge_kind not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ask friends
-- ---------------------------------------------------------------------------
create table ask_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  question text not null,
  reply_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- achievements
-- ---------------------------------------------------------------------------
create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  type text not null,
  title text not null,
  achieved_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: every table is circle-scoped to its members
-- ---------------------------------------------------------------------------
create function is_circle_member(target_circle_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = target_circle_id and user_id = auth.uid()
  );
$$;

alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table goals enable row level security;
alter table events enable row level security;
alter table nudges enable row level security;
alter table ask_posts enable row level security;
alter table achievements enable row level security;

create policy "profiles are readable by circle-mates" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from circle_members me
      join circle_members them on them.circle_id = me.circle_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "users manage their own profile" on profiles
  for update using (id = auth.uid());

create policy "members read their circles" on circles
  for select using (is_circle_member(id));

create policy "authenticated users create circles" on circles
  for insert with check (owner_id = auth.uid());

create policy "owners and admins update their circle" on circles
  for update using (
    exists (
      select 1 from circle_members
      where circle_id = circles.id and user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "members read circle membership" on circle_members
  for select using (is_circle_member(circle_id));

create policy "users join circles for themselves" on circle_members
  for insert with check (user_id = auth.uid());

create policy "owners and admins remove members" on circle_members
  for delete using (
    exists (
      select 1 from circle_members m
      where m.circle_id = circle_members.circle_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );

create policy "members read circle goals" on goals
  for select using (is_circle_member(circle_id));

create policy "members create their own goals" on goals
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members update their own goals" on goals
  for update using (user_id = auth.uid());

create policy "members read circle events" on events
  for select using (is_circle_member(circle_id));

create policy "members create their own events" on events
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members read circle nudges" on nudges
  for select using (
    exists (select 1 from events where events.id = nudges.event_id and is_circle_member(events.circle_id))
  );

create policy "members send nudges" on nudges
  for insert with check (
    from_user_id = auth.uid()
    and exists (select 1 from events where events.id = nudges.event_id and is_circle_member(events.circle_id))
  );

create policy "members read circle asks" on ask_posts
  for select using (is_circle_member(circle_id));

create policy "members create their own asks" on ask_posts
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members read circle achievements" on achievements
  for select using (is_circle_member(circle_id));

create policy "members create their own achievements" on achievements
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());
