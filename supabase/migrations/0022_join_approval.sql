-- Human-gated membership: a forwarded invite code currently grants instant
-- access (join_circle_by_invite_code inserts as an active member directly).
-- This adds a pending/active status so joining requires owner/admin
-- approval before the joiner can see anything circle-scoped.

alter table circle_members add column status text not null default 'active'
  check (status in ('pending', 'active'));

-- The central gate: every RLS policy across the schema that calls
-- is_circle_member() (goals, events, asks, achievements, nudges, circle
-- updates, ...) now excludes pending members automatically. This one change
-- is what keeps a pending member out of everything circle-scoped.
create or replace function is_circle_member(target_circle_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = target_circle_id and user_id = auth.uid()
      and deleted_at is null and status = 'active'
  );
$$;

-- Pending members still need to see the circle they're waiting on (name,
-- for a "waiting to join X" screen) and their own membership row (to detect
-- the pending -> active transition) - without gaining is_circle_member's
-- full access to anything else.
drop policy "members read their circles" on circles;
create policy "members read their circles" on circles
  for select using (
    deleted_at is null
    and (
      is_circle_member(id)
      or exists (
        select 1 from circle_members
        where circle_id = circles.id and user_id = auth.uid() and deleted_at is null
      )
    )
  );

drop policy "members read circle membership" on circle_members;
create policy "members read circle membership" on circle_members
  for select using (
    deleted_at is null
    and (is_circle_member(circle_id) or user_id = auth.uid())
  );

-- join_circle_by_invite_code now lands every new (or returning) joiner in
-- 'pending' instead of immediately active - including someone who left and
-- is rejoining, which deliberately requires re-approval rather than walking
-- straight back in.
create or replace function join_circle_by_invite_code(code text)
returns circles
language plpgsql
security definer set search_path = public
as $$
declare
  target_circle circles;
begin
  select * into target_circle from circles where invite_code = code and deleted_at is null;

  if target_circle.id is null then
    raise exception 'Invalid invite code';
  end if;

  if exists (
    select 1 from circle_members
    where circle_id = target_circle.id and user_id = auth.uid() and deleted_at is null
  ) then
    return target_circle;
  end if;

  -- Pending rows count toward the cap too, so a burst of join requests
  -- can't queue past 10 seats regardless of how many get approved.
  if (select count(*) from circle_members where circle_id = target_circle.id and deleted_at is null) >= 10 then
    raise exception 'Circle already has the maximum of 10 members';
  end if;

  insert into circle_members (circle_id, user_id, role, status)
  values (target_circle.id, auth.uid(), 'member', 'pending')
  on conflict (circle_id, user_id)
  do update set deleted_at = null, role = 'member', status = 'pending', joined_at = now();

  return target_circle;
end;
$$;

create function approve_member(p_circle_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
      and role in ('owner', 'admin') and status = 'active' and deleted_at is null
  ) then
    raise exception 'Only an owner or admin can approve members';
  end if;

  update circle_members set status = 'active'
  where circle_id = p_circle_id and user_id = p_user_id and status = 'pending' and deleted_at is null;
end;
$$;

create function reject_member(p_circle_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
      and role in ('owner', 'admin') and status = 'active' and deleted_at is null
  ) then
    raise exception 'Only an owner or admin can decline requests';
  end if;

  update circle_members set deleted_at = now()
  where circle_id = p_circle_id and user_id = p_user_id and status = 'pending' and deleted_at is null;
end;
$$;

-- Lets a pending joiner withdraw their own request (e.g. to try a different
-- circle instead of waiting) - the one self-service case, everything else
-- above requires owner/admin.
create function cancel_join_request(p_circle_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update circle_members set deleted_at = now()
  where circle_id = p_circle_id and user_id = auth.uid() and status = 'pending' and deleted_at is null;
$$;

grant execute on function approve_member(uuid, uuid) to authenticated;
grant execute on function reject_member(uuid, uuid) to authenticated;
grant execute on function cancel_join_request(uuid) to authenticated;

-- enforce_circle_member_limit() is untouched: it already counts every
-- non-deleted row regardless of status, so pending rows already count
-- toward the cap, per the comment above.

-- leave_circle() DOES need a fix: its ownership-transfer selection ordered
-- by role/joined_at over every non-deleted row with no status filter, which
-- would have let a pending member (who hasn't even been let into the
-- circle yet) get promoted to owner if they happened to be the
-- earliest-joined non-deleted row when an owner with no other active
-- members left.
create or replace function leave_circle(p_circle_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  my_role circle_role;
  remaining_count integer;
  next_owner uuid;
begin
  select role into my_role from circle_members
  where circle_id = p_circle_id and user_id = auth.uid() and deleted_at is null;
  if my_role is null then
    raise exception 'Not a member of this circle';
  end if;

  update circle_members set deleted_at = now()
  where circle_id = p_circle_id and user_id = auth.uid();

  select count(*) into remaining_count from circle_members
  where circle_id = p_circle_id and deleted_at is null and status = 'active';

  if remaining_count = 0 then
    update circles set deleted_at = now() where id = p_circle_id;
  elsif my_role = 'owner' then
    select user_id into next_owner
    from circle_members
    where circle_id = p_circle_id and deleted_at is null and status = 'active'
    order by case role when 'admin' then 0 else 1 end, joined_at asc
    limit 1;

    update circle_members set role = 'owner' where circle_id = p_circle_id and user_id = next_owner;
    update circles set owner_id = next_owner where id = p_circle_id;
  end if;
end;
$$;
