-- "Play Together" async features: Daily Circle Card, Circle Stories,
-- Would You Rather, Guess Who. All async/text-only by design - no
-- realtime infrastructure needed, same request/response pattern as
-- everything else in the app.

-- Daily Circle Card: one prompt per circle per day (client picks the
-- prompt deterministically from a shared bank), everyone answers once.
create table circle_card_answers (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  prompt_date date not null,
  prompt_text text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id, prompt_date)
);

-- Circle Stories: one sentence at a time, capped length, anyone can add
-- the next line (no turn enforcement - first write wins).
create table stories (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  prompt text not null,
  created_by uuid not null references profiles (id) on delete cascade,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table story_lines (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references stories (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

-- Would You Rather: simple A/B poll.
create table would_you_rather_polls (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  option_a text not null,
  option_b text not null,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table would_you_rather_votes (
  poll_id uuid not null references would_you_rather_polls (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- Guess Who: an anonymous-style fact about one member, others guess who.
create table guess_who_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  fact text not null,
  answer_user_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table guess_who_guesses (
  post_id uuid not null references guess_who_posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  guessed_user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table circle_card_answers enable row level security;
alter table stories enable row level security;
alter table story_lines enable row level security;
alter table would_you_rather_polls enable row level security;
alter table would_you_rather_votes enable row level security;
alter table guess_who_posts enable row level security;
alter table guess_who_guesses enable row level security;

create policy "members read circle card answers" on circle_card_answers
  for select using (is_circle_member(circle_id));
create policy "members post their own circle card answer" on circle_card_answers
  for insert with check (is_circle_member(circle_id) and user_id = auth.uid());

create policy "members read circle stories" on stories
  for select using (is_circle_member(circle_id));
create policy "members start circle stories" on stories
  for insert with check (is_circle_member(circle_id) and created_by = auth.uid());
create policy "members complete circle stories" on stories
  for update using (is_circle_member(circle_id));

create policy "members read story lines" on story_lines
  for select using (
    exists (select 1 from stories where stories.id = story_lines.story_id and is_circle_member(stories.circle_id))
  );
create policy "members add story lines" on story_lines
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from stories where stories.id = story_lines.story_id and is_circle_member(stories.circle_id))
  );

create policy "members read would-you-rather polls" on would_you_rather_polls
  for select using (is_circle_member(circle_id));
create policy "members create would-you-rather polls" on would_you_rather_polls
  for insert with check (is_circle_member(circle_id) and created_by = auth.uid());

create policy "members read would-you-rather votes" on would_you_rather_votes
  for select using (
    exists (
      select 1 from would_you_rather_polls
      where would_you_rather_polls.id = would_you_rather_votes.poll_id
        and is_circle_member(would_you_rather_polls.circle_id)
    )
  );
create policy "members cast would-you-rather votes" on would_you_rather_votes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from would_you_rather_polls
      where would_you_rather_polls.id = would_you_rather_votes.poll_id
        and is_circle_member(would_you_rather_polls.circle_id)
    )
  );

create policy "members read guess who posts" on guess_who_posts
  for select using (is_circle_member(circle_id));
create policy "members create guess who posts" on guess_who_posts
  for insert with check (is_circle_member(circle_id) and created_by = auth.uid());

create policy "members read guess who guesses" on guess_who_guesses
  for select using (
    exists (select 1 from guess_who_posts where guess_who_posts.id = guess_who_guesses.post_id and is_circle_member(guess_who_posts.circle_id))
  );
create policy "members submit guess who guesses" on guess_who_guesses
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from guess_who_posts where guess_who_posts.id = guess_who_guesses.post_id and is_circle_member(guess_who_posts.circle_id))
  );
