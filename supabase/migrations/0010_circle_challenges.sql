-- Circle Challenges: one shared target the whole circle contributes to
-- (e.g. "30-Day Water Challenge", "Save Rs 1,00,000 together"), rather
-- than a per-member goal. Progress is the sum of everyone's logged
-- contributions, not tracked on the challenge row itself, so it can
-- never drift from what members actually logged.
create table challenges (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  title text not null,
  target numeric not null,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table challenge_logs (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table challenges enable row level security;
alter table challenge_logs enable row level security;

create policy "members read circle challenges" on challenges
  for select using (is_circle_member(circle_id));

create policy "members create circle challenges" on challenges
  for insert with check (is_circle_member(circle_id) and created_by = auth.uid());

create policy "members read challenge logs" on challenge_logs
  for select using (
    exists (select 1 from challenges where challenges.id = challenge_logs.challenge_id and is_circle_member(challenges.circle_id))
  );

create policy "members log their own challenge contributions" on challenge_logs
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from challenges where challenges.id = challenge_logs.challenge_id and is_circle_member(challenges.circle_id))
  );
