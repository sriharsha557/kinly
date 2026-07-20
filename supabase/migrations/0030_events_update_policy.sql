-- events had SELECT + two narrow INSERT policies but no UPDATE at all -
-- needed so useSubmitMoodCheckin can overwrite today's mood_checkin
-- event's payload when someone changes their mood, instead of leaving a
-- stale mood frozen in Circle Activity forever after the first check-in
-- of the day. Same shape as the existing "create their own events" INSERT
-- policy - a user may only ever touch their own event rows.

create policy "members update their own events" on events
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
