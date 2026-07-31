-- 0011 added a carve-out on events.insert for buddy check-ins, back when
-- that insert used type = 'reminder'. A later change on this branch moved
-- the check-in insert to its own type, 'buddy_checkin' (see
-- useCheckInOnBuddy in src/hooks/useBuddy.ts), so the carve-out below no
-- longer matches anything it inserts, and the general "self-attributed
-- events only" policy (0001_init.sql) doesn't match it either, since
-- user_id on this row is the buddy being checked *on* - the subject of the
-- row, not the caller performing the insert. Net effect: every check-in
-- insert was rejected by RLS (42501) and the feature was silently dead.
--
-- Replaces the old policy with one scoped to 'buddy_checkin' only. Verified
-- via `grep -rn "type: 'reminder'" src/` that no client code inserts
-- 'reminder' events anymore - those now come exclusively from the
-- check-streaks-at-risk edge function, which uses the service-role key and
-- bypasses RLS entirely - so there is no reason to keep 'reminder' in this
-- carve-out too. Narrower is safer: this policy should only ever admit the
-- one insert it exists for.
drop policy if exists "members create check-in reminders for circle-mates" on events;

create policy "members create buddy check-ins for circle-mates" on events
  for insert with check (type = 'buddy_checkin' and is_circle_member(circle_id));
