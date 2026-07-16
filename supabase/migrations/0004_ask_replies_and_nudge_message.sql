-- Ask Friends needs threaded discussion (PRD 7.5 "Each post supports discussion"),
-- and nudges need somewhere to hold the AI-generated encouragement text.

create table ask_replies (
  id uuid primary key default gen_random_uuid(),
  ask_post_id uuid not null references ask_posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table nudges add column message text;

alter table ask_replies enable row level security;

create policy "members read replies on circle asks" on ask_replies
  for select using (
    exists (
      select 1 from ask_posts
      where ask_posts.id = ask_replies.ask_post_id and is_circle_member(ask_posts.circle_id)
    )
  );

create policy "members reply to circle asks" on ask_replies
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from ask_posts
      where ask_posts.id = ask_replies.ask_post_id and is_circle_member(ask_posts.circle_id)
    )
  );

create function increment_ask_reply_count()
returns trigger
language plpgsql
as $$
begin
  update ask_posts set reply_count = reply_count + 1 where id = new.ask_post_id;
  return new;
end;
$$;

create trigger on_ask_reply_created
  after insert on ask_replies
  for each row execute procedure increment_ask_reply_count();
