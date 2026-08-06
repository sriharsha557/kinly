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
-- A target_count of zero or negative is not a commitment, and it is not
-- merely meaningless - Task 6 found it made the streak calculation loop
-- forever, because the loop's step size came from this value. The database
-- must not be able to store what the app already refuses to compute. Folded
-- into the column add (rather than a standalone add constraint) so it needs
-- no ACCESS EXCLUSIVE validation scan of goals.
alter table goals add column target_count integer
  check (target_count is null or target_count > 0);
alter table goals add column target_weekdays integer[];
alter table goals add column status text not null default 'active'
  check (status in ('active', 'ended'));
alter table goals add column started_at date not null default current_date;
-- Existing goals did not start today. created_at (0001) is their real
-- origin, and without this every historical commitment would claim it
-- began on the day this migration was pasted into the Dashboard.
update goals set started_at = created_at::date;
alter table goals add column ended_at date;
alter table goals add column ended_reason text
  check (ended_reason in ('replaced', 'migration', 'deleted', 'completed'));
-- 'habit' today. Challenges, reading plans, savings plans and training plans
-- are all commitments and can later share this table rather than each
-- inventing a parallel one.
alter table goals add column kind text not null default 'habit';

-- One active goal per member per Area. deleted_at participates because this
-- app soft-deletes (0019) and a deleted goal must not block its replacement.
--
-- The unique index itself is NOT created here. 0047's backfill assigns
-- area_id to every mappable goal in a single UPDATE (its step 1), and a
-- member with two active goals in the same category - the ordinary case,
-- not an edge case - would violate this index the instant that UPDATE wrote
-- the second row, aborting the whole backfill before its step 3 dedupe ever
-- ran. The index is created at the end of 0047 instead, after the backfill
-- has resolved those collisions and the constraint can actually hold.

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

-- No separate index here: the unique (goal_id, checkin_date) constraint
-- above already builds a btree on those columns, and btree scans backward,
-- so it already serves "this goal's check-ins, most recent first."

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
  -- goals enforces these same two guarantees (target_type's cadence check,
  -- target_count's positivity check). This archive table reads back into
  -- the history UI, so it must not be a hole where goals forbids a value
  -- but goal_history happily stores it.
  target_type text
    check (target_type is null or target_type in ('daily', 'times_per_week', 'specific_weekdays', 'monthly')),
  target_count integer
    check (target_count is null or target_count > 0),
  target_weekdays integer[],
  started_at date,
  ended_at date not null default current_date,
  best_streak integer not null default 0,
  ended_reason text not null
    check (ended_reason in ('replaced', 'migration', 'deleted', 'completed')),
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

-- Trailing ended_at desc because the query this index exists for is "this
-- member's history, most recent first" - without it the index doesn't serve
-- that ordering.
create index goal_history_member on goal_history (circle_id, user_id, area_id, ended_at desc);

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
      -- leave_circle (0022) soft-deletes the membership row but leaves
      -- role='owner' sitting on it, so role alone is not authority - a
      -- departed owner or a removed admin would otherwise keep permanent
      -- power to toggle this circle's Areas.
      where circle_id = circle_areas.circle_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
        and deleted_at is null
        and status = 'active'
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
    -- checkin_date only DEFAULTs to current_date; a client can still send any
    -- date it likes. current_date is not IMMUTABLE, so a CHECK constraint
    -- can't express this, but RLS can. Without it a client could post a
    -- future date or backfill 200 consecutive past days and manufacture a
    -- streak, in an app whose entire social currency is streaks. Cheapest to
    -- close now, before any writer exists to depend on the looser behavior.
    and checkin_date <= current_date
  );

create policy "members undo their own check-in" on goal_checkins
  for delete using (user_id = auth.uid());

-- Deliberately no UPDATE policy on goal_checkins: this table is append-only
-- and idempotency comes from the unique (goal_id, checkin_date) constraint
-- above, not from updating an existing row. That means a client .upsert()
-- will be rejected by RLS with error 42501 the moment it takes the
-- ON CONFLICT DO UPDATE path. Check-ins must be written with
-- `insert ... on conflict do nothing` (supabase-js:
-- `.insert(..., { ignoreDuplicates: true })`).

create policy "members read circle goal history" on goal_history
  for select using (is_circle_member(circle_id));

create policy "members archive their own goals" on goal_history
  for insert with check (user_id = auth.uid() and is_circle_member(circle_id));

-- needs_review is set by this migration for migrated goals and cleared by
-- the person who owns the row, so it needs an UPDATE path - without one,
-- RLS silently denies every attempt to clear the flag.
--
-- with check also requires is_circle_member(circle_id), not just row
-- ownership. 0036 closed this identical gap on goals, vision_items,
-- mood_checkins and buddy_pairs: USING alone lets a member rewrite the FK on
-- a row they own to point at a circle they aren't in, injecting a fabricated
-- "previous goal" into that circle's history. Without this WITH CHECK,
-- goal_history would reopen the exact hole 0036 exists to close.
create policy "members update their own goal history" on goal_history
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_circle_member(circle_id));
