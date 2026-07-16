-- Circle creation/joining as atomic RPCs.
--
-- Plain client-side inserts don't work here: RLS on `circles` only lets a
-- member read a circle row (is_circle_member), but the owner isn't a member
-- yet at the moment the circle is created, and a joiner can't SELECT a
-- circle by invite_code before they've joined it either. Security-definer
-- functions do the lookup/insert/membership as one transaction and hand
-- back the row, sidestepping that chicken-and-egg RLS ordering.

create function create_circle(circle_name text)
returns circles
language plpgsql
security definer set search_path = public
as $$
declare
  new_circle circles;
begin
  insert into circles (name, owner_id) values (circle_name, auth.uid()) returning * into new_circle;
  insert into circle_members (circle_id, user_id, role) values (new_circle.id, auth.uid(), 'owner');
  return new_circle;
end;
$$;

create function join_circle_by_invite_code(code text)
returns circles
language plpgsql
security definer set search_path = public
as $$
declare
  target_circle circles;
begin
  select * into target_circle from circles where invite_code = code;

  if target_circle.id is null then
    raise exception 'Invalid invite code';
  end if;

  if not exists (
    select 1 from circle_members
    where circle_id = target_circle.id and user_id = auth.uid()
  ) then
    insert into circle_members (circle_id, user_id, role) values (target_circle.id, auth.uid(), 'member');
  end if;

  return target_circle;
end;
$$;

grant execute on function create_circle(text) to authenticated;
grant execute on function join_circle_by_invite_code(text) to authenticated;
