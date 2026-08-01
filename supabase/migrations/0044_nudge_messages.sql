-- Curated nudge copy, replacing the per-call Claude API generator
-- (docs/superpowers/specs/2026-08-01-nudge-message-library-design.md).
--
-- The API version cost money per cheer, added a third-party round trip before
-- the nudge row was even written, silently degraded to one canned string per
-- kind past a 30/day cap, and - asked for a "specific" message while given no
-- facts - once congratulated a real user on a presentation they never gave.
-- Nudges do not need originality. They need to be warm, instant and true.
--
-- Postgres cannot add an enum value and use it in the same transaction, so
-- the alter below must run as its own statement. The SQL Editor does that
-- automatically; do not wrap this file in an explicit begin/commit.

-- A tough-day check-in used to send 'keep_going' - the same kind as "keep
-- going on your goal". Someone who has just said today was hard should not
-- be told to push harder, so support gets its own pool.
alter type nudge_kind add value if not exists 'support';

create table if not exists nudge_messages (
  id           uuid primary key default gen_random_uuid(),
  kind         nudge_kind not null,
  -- The substitutions this message REQUIRES. It is only ever eligible when
  -- the caller can supply every one of them. An array rather than a single
  -- column so a future {circle} needs no migration.
  placeholders text[] not null default '{}',
  body         text not null,
  -- Biases selection: safe-anywhere lines earn more, situational ones earn 1.
  weight       integer not null default 1 check (weight > 0),
  -- Retire copy without deleting it: a line that lands badly is switched off
  -- with one update and stays in history.
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table nudge_messages enable row level security;

-- Reference data: any signed-in user reads it, nobody writes it from the
-- app. Edits happen here, in SQL.
-- Dropped first so the whole file is genuinely re-runnable: the create
-- table and alter type above both say "if not exists", which reads as
-- idempotent, but create policy has no such clause and would error on a
-- second run.
drop policy if exists "authenticated users read nudge messages" on nudge_messages;

create policy "authenticated users read nudge messages" on nudge_messages
  for select to authenticated using (true);
