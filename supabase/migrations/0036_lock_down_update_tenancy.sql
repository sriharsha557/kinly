-- Security fix: every "members update their own X" policy below only
-- checked USING (user_id = auth.uid()), never WITH CHECK - Postgres reuses
-- the USING clause for WITH CHECK when none is given, so only row
-- *ownership* was validated, never the tenancy-defining foreign key
-- (circle_id / meetup_id). That let any member rewrite that FK on a row
-- they own to point at a circle/entity they aren't a member of, injecting
-- content (a goal, a vision-board item, an RSVP, a buddy claim) into a
-- circle they have no relationship with. `events` had the identical gap
-- and was closed in migration 0032; this closes it everywhere else it
-- still existed.

drop policy if exists "members update their own goals" on goals;
create policy "members update their own goals" on goals
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_circle_member(circle_id));

drop policy if exists "members update their own vision items" on vision_items;
create policy "members update their own vision items" on vision_items
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_circle_member(circle_id));

drop policy if exists "members update their own mood checkins" on mood_checkins;
create policy "members update their own mood checkins" on mood_checkins
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_circle_member(circle_id));

drop policy if exists "members change their own buddy" on buddy_pairs;
create policy "members change their own buddy" on buddy_pairs
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_circle_member(circle_id));

-- meetup_rsvps has no circle_id column of its own - membership is via
-- meetups.circle_id, same shape as this table's own INSERT policy.
drop policy if exists "members change their own rsvp" on meetup_rsvps;
create policy "members change their own rsvp" on meetup_rsvps
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from meetups where meetups.id = meetup_rsvps.meetup_id and is_circle_member(meetups.circle_id))
  );
