-- Switch from physical deletes to soft deletes on the tables that are ever
-- an explicit DELETE target: profiles, circles, circle_members, goals,
-- ask_posts, vision_items. Every other table is only ever removed via
-- `on delete cascade` from one of these (ultimately from profiles, which
-- cascades from auth.users) - so stopping physical deletes here is enough
-- to stop it everywhere, without adding an unused deleted_at column to
-- tables nothing ever deletes directly (events, nudges, challenges, etc).

alter table profiles add column deleted_at timestamptz;
alter table circles add column deleted_at timestamptz;
alter table circle_members add column deleted_at timestamptz;
alter table goals add column deleted_at timestamptz;
alter table ask_posts add column deleted_at timestamptz;
alter table vision_items add column deleted_at timestamptz;

-- Stop the cascade at its root: today nothing calls Supabase's user-deletion
-- API, but if that ever happens (account deletion), this previously would
-- have hard-deleted the profile and cascaded through every circle they own,
-- every goal, every event, every nudge, etc. Breaking this FK means that
-- path has to go through an explicit soft-delete instead.
alter table profiles drop constraint profiles_id_fkey;
alter table profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete no action;

-- ---------------------------------------------------------------------------
-- Membership-aware functions must exclude soft-deleted rows, or a member who
-- left (or was removed) keeps counting as a member forever.
-- ---------------------------------------------------------------------------
create or replace function is_circle_member(target_circle_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from circle_members
    where circle_id = target_circle_id and user_id = auth.uid() and deleted_at is null
  );
$$;

create or replace function enforce_circle_member_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from circle_members where circle_id = new.circle_id and deleted_at is null) >= 10 then
    raise exception 'Circle already has the maximum of 10 members';
  end if;
  return new;
end;
$$;

-- join_circle_by_invite_code: a returning member (previously soft-deleted
-- circle_members row) must be reactivated, not silently skipped - the old
-- "exists at all" check would find their old row and never re-insert one.
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

  if (select count(*) from circle_members where circle_id = target_circle.id and deleted_at is null) >= 10 then
    raise exception 'Circle already has the maximum of 10 members';
  end if;

  insert into circle_members (circle_id, user_id, role)
  values (target_circle.id, auth.uid(), 'member')
  on conflict (circle_id, user_id)
  do update set deleted_at = null, role = 'member', joined_at = now();

  return target_circle;
end;
$$;

-- leave_circle: soft-delete the membership (and the circle, if it was the
-- last active member) instead of deleting the rows.
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
  where circle_id = p_circle_id and deleted_at is null;

  if remaining_count = 0 then
    update circles set deleted_at = now() where id = p_circle_id;
  elsif my_role = 'owner' then
    select user_id into next_owner
    from circle_members
    where circle_id = p_circle_id and deleted_at is null
    order by case role when 'admin' then 0 else 1 end, joined_at asc
    limit 1;

    update circle_members set role = 'owner' where circle_id = p_circle_id and user_id = next_owner;
    update circles set owner_id = next_owner where id = p_circle_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: exclude soft-deleted rows from every select policy on the 6 tables.
-- ---------------------------------------------------------------------------
drop policy "profiles are readable by circle-mates" on profiles;
create policy "profiles are readable by circle-mates" on profiles
  for select using (
    deleted_at is null
    and (
      id = auth.uid()
      or exists (
        select 1 from circle_members me
        join circle_members them on them.circle_id = me.circle_id
        where me.user_id = auth.uid() and me.deleted_at is null
          and them.user_id = profiles.id and them.deleted_at is null
      )
    )
  );

drop policy "members read their circles" on circles;
create policy "members read their circles" on circles
  for select using (deleted_at is null and is_circle_member(id));

drop policy "members read circle membership" on circle_members;
create policy "members read circle membership" on circle_members
  for select using (deleted_at is null and is_circle_member(circle_id));

drop policy "members read circle goals" on goals;
create policy "members read circle goals" on goals
  for select using (deleted_at is null and is_circle_member(circle_id));

drop policy "members read circle asks" on ask_posts;
create policy "members read circle asks" on ask_posts
  for select using (deleted_at is null and is_circle_member(circle_id));

drop policy "members read circle vision items" on vision_items;
create policy "members read circle vision items" on vision_items
  for select using (deleted_at is null and is_circle_member(circle_id));

-- ask_posts never had an update policy (posts are meant to be immutable
-- after posting - see migration 0009). Give soft-delete its own narrow RPC
-- instead of opening a general update policy that would let the question
-- text itself be edited.
create function soft_delete_ask_post(p_ask_post_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update ask_posts set deleted_at = now() where id = p_ask_post_id and user_id = auth.uid();
$$;

grant execute on function soft_delete_ask_post(uuid) to authenticated;

-- goals and vision_items already have general "members update their own X"
-- policies (title/target, title/image_url are already editable that way),
-- so deleted_at can ride through the same existing policy - no new risk.
drop policy "members delete their own goals" on goals;
drop policy "members delete their own asks" on ask_posts;
drop policy "members delete their own vision items" on vision_items;

-- Unused by any current feature (no "remove member" button exists yet), but
-- left in place it's a physical-delete escape hatch for whenever that gets
-- built. A future remove-member feature can soft-delete through the
-- existing "owners and admins change member roles" update policy (0003)
-- instead, which already permits updating any row in an owner/admin's circle.
drop policy "owners and admins remove members" on circle_members;
