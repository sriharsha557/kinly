-- Tightens 0041's buddy_checkin insert policy, which admits the row on
-- `type = 'buddy_checkin' and is_circle_member(circle_id)` alone. Nothing
-- there constrains `user_id` - the row's *subject*, the person being reached
-- out to - so as written a circle member can insert an event naming any UUID
-- at all as its subject, including themselves.
--
-- That matters because notify-circle routes the resulting nudge's push by
-- reading the event's user_id, and the nudges insert policy (0001) only
-- checks from_user_id = auth.uid() plus membership of the *event's* circle.
-- So the gap let a member push arbitrary text at a chosen user id, and let
-- someone manufacture an event about themselves.
--
-- The hole predates this migration - 0041 only widened buddy_checkin from
-- "your buddy" to "anyone in the circle", which is what made the missing
-- subject constraint worth closing. The app's own inserts already satisfy
-- both new conditions: useNudgeMember is never called with the sender as
-- target (needsAttention excludes the viewer, and the members list renders
-- no action on your own row), and it only ever targets members it read out
-- of the circle's own roster.
drop policy if exists "members create buddy check-ins for circle-mates" on events;

create policy "members create buddy check-ins for circle-mates" on events
  for insert with check (
    type = 'buddy_checkin'
    and is_circle_member(circle_id)
    -- You reach out to someone else, never to yourself.
    and user_id <> auth.uid()
    -- And only to someone actually in this circle.
    and exists (
      select 1
      from circle_members
      where circle_members.circle_id = events.circle_id
        and circle_members.user_id = events.user_id
        and circle_members.status = 'active'
        and circle_members.deleted_at is null
    )
  );
