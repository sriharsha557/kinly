-- Future Self: a letter you write now, sealed until a year later. Purely
-- personal (not circle-shared), so RLS is a simple "only the author" rule
-- with no circle-membership check needed.
create table future_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  content text not null,
  unlock_date date not null,
  created_at timestamptz not null default now(),
  opened_at timestamptz
);

alter table future_letters enable row level security;

create policy "users manage their own letters" on future_letters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vision Board: what each member is working toward, visible to the whole
-- circle (so friends can see what you're building toward, per the PRD's
-- "friends see what you're working toward" framing).
create table vision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  circle_id uuid not null references circles (id) on delete cascade,
  title text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table vision_items enable row level security;

create policy "members read circle vision items" on vision_items
  for select using (is_circle_member(circle_id));

create policy "members manage their own vision items" on vision_items
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members update their own vision items" on vision_items
  for update using (user_id = auth.uid());

create policy "members delete their own vision items" on vision_items
  for delete using (user_id = auth.uid());
