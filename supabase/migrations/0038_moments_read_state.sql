-- Unread state for the Moments feed (docs/superpowers/specs/2026-07-31-
-- notifications-design.md). Null means "never read", so a new member sees
-- everything as new. Keyed per (user, circle) - circle_members is already
-- keyed that way, so no new table is needed.
alter table circle_members add column if not exists last_read_events_at timestamptz;

-- Members must be able to stamp their own read state, but the only UPDATE
-- policy on circle_members (0003) is owner/admin-only. A permissive
-- "update your own row" policy is not an option: RLS grants the whole row,
-- so a member could also set role = 'owner'. This security-definer function
-- writes exactly one column for exactly the calling user instead.
create or replace function mark_moments_read(p_circle_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update circle_members
  set last_read_events_at = now()
  where circle_id = p_circle_id
    and user_id = auth.uid()
    and status = 'active';
$$;

revoke all on function mark_moments_read(uuid) from public;
grant execute on function mark_moments_read(uuid) to authenticated;
