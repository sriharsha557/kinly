-- Vision Board image upload: same per-user-folder pattern as the avatars
-- bucket (path convention <user_id>/<filename>), but a separate bucket so
-- avatar and vision-board storage limits/policies stay independent.
insert into storage.buckets (id, name, public)
values ('vision-images', 'vision-images', true)
on conflict (id) do nothing;

create policy "vision images are publicly readable" on storage.objects
  for select using (bucket_id = 'vision-images');

create policy "users upload their own vision images" on storage.objects
  for insert with check (
    bucket_id = 'vision-images' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own vision images" on storage.objects
  for delete using (
    bucket_id = 'vision-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
