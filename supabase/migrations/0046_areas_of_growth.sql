-- Areas of Growth: per-member commitments grouped under a shared, curated
-- Area catalog (docs/superpowers/specs/2026-08-05-areas-of-growth-design.md).
--
-- Goals were always per-member (goals.user_id, since 0001). What was missing
-- was cadence, a per-day check-in ledger and an archive, so goals is evolved
-- in place - five tables and ~45 files reference goals.id, and renaming it
-- would orphan feed entries that are years of a circle's memory.

-- ---------------------------------------------------------------------------
-- areas: the curated catalog. Members cannot create Areas, and that is
-- enforced here rather than only in the UI - there is deliberately no insert,
-- update or delete policy on this table.
-- ---------------------------------------------------------------------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  emoji text not null,
  sort_order integer not null
);

insert into areas (key, label, emoji, sort_order) values
  ('health',     'Health',     '❤️',   1),
  ('mind',       'Mind',       '🧠',   2),
  ('learning',   'Learning',   '📚',   3),
  ('finance',    'Finance',    '💰',   4),
  ('career',     'Career',     '💼',   5),
  ('family',     'Family',     '👨‍👩‍👧', 6),
  ('creativity', 'Creativity', '🎨',   7),
  ('community',  'Community',  '🌍',   8);

-- ---------------------------------------------------------------------------
-- circle_areas: which Areas a circle has turned on. Disabling an Area drops
-- it from rollups and leaves its goals dormant - it must never archive them.
-- Destroying members' commitments as a side effect of a settings toggle would
-- be the most damaging action in the app.
-- ---------------------------------------------------------------------------
create table circle_areas (
  circle_id uuid not null references circles (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (circle_id, area_id)
);

-- ---------------------------------------------------------------------------
-- goals, evolved into a commitment
-- ---------------------------------------------------------------------------
alter table goals add column area_id uuid references areas (id);
alter table goals add column target_type text
  check (target_type in ('daily', 'times_per_week', 'specific_weekdays', 'monthly'));
alter table goals add column target_count integer;
-- A target_count of zero or negative is not a commitment, and it is not
-- merely meaningless - Task 6 found it made the streak calculation loop
-- forever, because the loop's step size came from this value. The database
-- must not be able to store what the app already refuses to compute.
alter table goals add constraint goals_target_count_positive
  check (target_count is null or target_count > 0);
alter table goals add column target_weekdays integer[];
alter table goals add column status text not null default 'active'
  check (status in ('active', 'ended'));
alter table goals add column started_at date not null default current_date;
alter table goals add column ended_at date;
alter table goals add column ended_reason text
  check (ended_reason in ('replaced', 'migration', 'deleted', 'completed'));
-- 'habit' today. Challenges, reading plans, savings plans and training plans
-- are all commitments and can later share this table rather than each
-- inventing a parallel one.
alter table goals add column kind text not null default 'habit';

-- One active goal per member per Area. deleted_at participates because this
-- app soft-deletes (0019) and a deleted goal must not block its replacement.
create unique index goals_one_active_per_area
  on goals (circle_id, user_id, area_id)
  where status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- goal_checkins: the "done" ledger. One row per goal per day.
-- ---------------------------------------------------------------------------
create table goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  -- Makes check-in idempotent: a double tap, an offline replay and a device
  -- re-sync cannot inflate a streak.
  unique (goal_id, checkin_date)
);

create index goal_checkins_goal_date on goal_checkins (goal_id, checkin_date desc);

-- ---------------------------------------------------------------------------
-- goal_history: the archive. The goals row is NOT deleted when a commitment
-- ends - it is marked status='ended' - because events, streak_saves, buddy
-- check-ins, challenges and the life timeline all hold goal_id. This table is
-- the denormalized summary, including best_streak, which the live row does
-- not retain after a reset.
-- ---------------------------------------------------------------------------
create table goal_history (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals (id) on delete set null,
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  area_id uuid references areas (id),
  title text not null,
  target_type text,
  target_count integer,
  target_weekdays integer[],
  started_at date,
  ended_at date not null default current_date,
  best_streak integer not null default 0,
  ended_reason text not null
    check (ended_reason in ('replaced', 'migration', 'deleted', 'completed')),
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index goal_history_member on goal_history (circle_id, user_id, area_id);

-- ---------------------------------------------------------------------------
-- RLS, mirroring the circle-scoped pattern established in 0001
-- ---------------------------------------------------------------------------
alter table areas enable row level security;
alter table circle_areas enable row level security;
alter table goal_checkins enable row level security;
alter table goal_history enable row level security;

create policy "the area catalog is readable by everyone signed in" on areas
  for select using (auth.uid() is not null);

create policy "members read their circle's areas" on circle_areas
  for select using (is_circle_member(circle_id));

create policy "owners and admins manage circle areas" on circle_areas
  for all using (
    exists (
      select 1 from circle_members
      where circle_id = circle_areas.circle_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "members read circle check-ins" on goal_checkins
  for select using (
    exists (select 1 from goals g where g.id = goal_checkins.goal_id and is_circle_member(g.circle_id))
  );

create policy "members check in for themselves" on goal_checkins
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from goals g where g.id = goal_id and g.user_id = auth.uid())
  );

create policy "members undo their own check-in" on goal_checkins
  for delete using (user_id = auth.uid());

create policy "members read circle goal history" on goal_history
  for select using (is_circle_member(circle_id));

create policy "members archive their own goals" on goal_history
  for insert with check (user_id = auth.uid() and is_circle_member(circle_id));
