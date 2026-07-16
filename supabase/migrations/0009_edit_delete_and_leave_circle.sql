-- Goals/Ask posts were missing DELETE policies entirely (edit is a plain
-- client-side update, already covered by existing policies for goals; ask
-- posts are delete-only, not edit-after-posting, to avoid a question
-- changing meaning mid-discussion).
create policy "members delete their own goals" on goals
  for delete using (user_id = auth.uid());

create policy "members delete their own asks" on ask_posts
  for delete using (user_id = auth.uid());

-- Leaving a circle needs to reassign ownership atomically if the owner
-- leaves, and clean up an orphaned circle if the last member leaves.
-- security definer because the ownership-transfer step must still work
-- after the caller is no longer a member (RLS would otherwise block it
-- partway through); the function enforces membership itself before
-- mutating anything, so this doesn't weaken authorization.
create function leave_circle(p_circle_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  my_role circle_role;
  remaining_count integer;
  next_owner uuid;
begin
  select role into my_role from circle_members where circle_id = p_circle_id and user_id = auth.uid();
  if my_role is null then
    raise exception 'Not a member of this circle';
  end if;

  delete from circle_members where circle_id = p_circle_id and user_id = auth.uid();

  select count(*) into remaining_count from circle_members where circle_id = p_circle_id;

  if remaining_count = 0 then
    delete from circles where id = p_circle_id;
  elsif my_role = 'owner' then
    select user_id into next_owner
    from circle_members
    where circle_id = p_circle_id
    order by case role when 'admin' then 0 else 1 end, joined_at asc
    limit 1;

    update circle_members set role = 'owner' where circle_id = p_circle_id and user_id = next_owner;
    update circles set owner_id = next_owner where id = p_circle_id;
  end if;
end;
$$;

grant execute on function leave_circle(uuid) to authenticated;
