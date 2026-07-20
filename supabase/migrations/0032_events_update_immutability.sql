-- 0030's "members update their own events" policy is row-level only (RLS
-- can't restrict by column) - as written, it lets an owner rewrite
-- circle_id, type, or created_at on their own event rows via a direct
-- client call (supabase.from('events').update(...)), not just payload.
-- submit_mood_checkin() (migration 0031) only ever touches payload, so
-- this doesn't break anything legitimate - it closes a gap the policy
-- left open (moving an event to a circle you're not even a member of,
-- relabeling its type, or backdating it to manipulate feed ordering).
-- A trigger, not a column-level GRANT: Supabase's default UPDATE grant to
-- authenticated is broad and set up outside these migrations, so REVOKE-
-- then-narrow-GRANT would depend on an assumption these migrations don't
-- actually control. A trigger is self-contained and fires regardless of
-- how the row is touched.

create or replace function enforce_events_update_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.circle_id is distinct from old.circle_id
    or new.type is distinct from old.type
    or new.created_at is distinct from old.created_at
    or new.user_id is distinct from old.user_id
  then
    raise exception 'circle_id, type, user_id, and created_at cannot be changed on an existing event';
  end if;
  return new;
end;
$$;

create trigger events_update_immutability
  before update on events
  for each row
  execute function enforce_events_update_immutability();
