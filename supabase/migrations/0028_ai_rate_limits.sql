-- Per-user daily caps on the three Claude-calling Edge Functions
-- (generate-nudge-message, circle-ai-insight, weekly-recap). Previously
-- nothing stopped a user (or a bug, or a bot) from generating unlimited
-- AI calls - max_tokens only bounded the cost of a single call, not how
-- many could be made. increment_ai_usage() does an atomic upsert-and-check
-- so concurrent requests from the same user can't race past the cap.

create table if not exists ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  fn text not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, fn, day)
);

alter table ai_rate_limits enable row level security;

-- No client-facing policies: this table is only ever touched via
-- increment_ai_usage() below, called from an Edge Function using the
-- caller's own JWT (same pattern as delete_my_account()).

create or replace function increment_ai_usage(p_fn text, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  insert into ai_rate_limits (user_id, fn, day, count)
  values (auth.uid(), p_fn, current_date, 1)
  on conflict (user_id, fn, day)
  do update set count = ai_rate_limits.count + 1
  returning count into new_count;

  return new_count <= p_max;
end;
$$;

grant execute on function increment_ai_usage(text, int) to authenticated;

-- Old rows aren't needed past their own day; keeps the table small without
-- needing a scheduled job - each call only ever touches "today"'s row.
create index if not exists ai_rate_limits_day_idx on ai_rate_limits (day);
