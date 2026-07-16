-- Profile: bio field, plus a public avatars bucket so users can upload a
-- picture (path convention: <user_id>/<filename>, enforced by the policies
-- below so a user can only write inside their own folder).
alter table profiles add column bio text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "users upload their own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update their own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ask Friends posts can optionally reference one of the asker's own goals
-- (e.g. "any tips for my running goal?" linked to that Goal row).
alter table ask_posts add column goal_id uuid references goals (id) on delete set null;
