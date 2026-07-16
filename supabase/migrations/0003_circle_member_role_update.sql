-- Circle Settings needs a role picker (PRD 7.1 / screen 5), which requires
-- an UPDATE policy on circle_members that the initial migration didn't have.
create policy "owners and admins change member roles" on circle_members
  for update using (
    exists (
      select 1 from circle_members m
      where m.circle_id = circle_members.circle_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
    )
  );
