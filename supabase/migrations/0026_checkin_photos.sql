-- Photo proof check-ins: an optional photo attached to a goal-progress log.
-- Private bucket (unlike avatars/vision-images, which are public) - a
-- circle-mate's photo mid-progress deserves real access control, not just
-- an unguessable URL. Path convention `<circle_id>/<user_id>-<timestamp>.ext`
-- (not `<user_id>/...` like avatars/vision-images) so RLS can gate reads/
-- writes by circle membership via storage.foldername(), and so the
-- account-deletion cleanup can find one user's photos within a circle
-- folder shared by several members (see delete-account's updated
-- STORAGE_BUCKETS handling).
insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', false)
on conflict (id) do nothing;

create policy "circle members read their circle's checkin photos" on storage.objects
  for select using (
    bucket_id = 'checkin-photos' and is_circle_member((storage.foldername(name))[1]::uuid)
  );

create policy "circle members upload checkin photos to their circle" on storage.objects
  for insert with check (
    bucket_id = 'checkin-photos' and is_circle_member((storage.foldername(name))[1]::uuid)
  );

-- Used for a plain progress log that isn't also a completion/streak
-- milestone - those already get an events row from useLogGoalWithCelebration
-- and just get the photo path attached to that row's payload instead of a
-- second, redundant event.
alter type event_type add value if not exists 'progress_photo';
