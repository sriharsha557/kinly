-- Shareable weekly scorecard: extends the recap with a circle health delta
-- ("+12% this week"), which needs a historical value to compare against -
-- Garden health is otherwise computed live from goals data with no stored
-- history (see ARCHITECTURE.md's "Derived vs. stored state"). Rather than
-- add a new cron, check-streaks-at-risk (already scheduled daily via
-- migration 0016) is extended to also write one of these per active circle
-- on its existing run - a week of daily snapshots gives weekly-recap
-- something to diff against.
create table circle_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  health integer not null,
  snapshotted_at date not null default current_date,
  unique (circle_id, snapshotted_at)
);

alter table circle_health_snapshots enable row level security;

create policy "members read their circle health snapshots" on circle_health_snapshots
  for select using (is_circle_member(circle_id));

-- No client INSERT policy - only the check-streaks-at-risk cron (service
-- role, bypasses RLS) ever writes these.
