-- Expo push tokens per device, used by the notify-circle Edge Function
-- to deliver goal/streak/ask/nudge/reply pushes (PRD section 7).
create table push_tokens (
  user_id uuid not null references profiles (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

create policy "users manage their own push tokens" on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
