// Unread bookkeeping for the Moments feed (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). Deliberately dependency-free: it is
// imported by the app under Metro and by node:test under
// --experimental-strip-types, and cross-file type imports would need module
// resolution the stripper does not perform.

export interface UnreadCandidate {
  created_at: string;
  user_id: string;
  // Who *performed* the action, when that isn't the row's user_id.
  //
  // For nearly every event type the two are the same: user_id is the person
  // who completed the goal, hit the streak, posted the ask. But a
  // 'buddy_checkin' row is *about* its user_id - it records that someone
  // reached out to them - so its actor is the sender, carried in the
  // payload as from_user_id. Without this the rule inverts exactly: cheering
  // someone would mark your own feed unread and leave theirs untouched.
  //
  // Optional because rows written before this field existed have no sender
  // recorded; those fall back to user_id, i.e. to the old behaviour, which
  // is the right call for history nobody is going to re-read anyway.
  actor_id?: string | null;
}

function actorOf(event: UnreadCandidate): string {
  return event.actor_id ?? event.user_id;
}

// Your own actions never mark your own feed unread, so the actor is excluded.
// A null stamp means "never read", which makes every other member's event
// unread - correct for a brand-new member.
// created_at values are ISO-8601 UTC strings from Postgres, so lexicographic
// comparison is chronological; an event exactly at the stamp counts as read.
export function isUnreadFor(
  event: UnreadCandidate,
  lastReadAt: string | null,
  viewerId: string,
): boolean {
  return actorOf(event) !== viewerId && (lastReadAt === null || event.created_at > lastReadAt);
}

export function countUnreadEvents(
  events: readonly UnreadCandidate[],
  lastReadAt: string | null,
  viewerId: string,
): number {
  return events.filter((event) => isUnreadFor(event, lastReadAt, viewerId)).length;
}
