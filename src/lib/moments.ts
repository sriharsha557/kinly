// Unread bookkeeping for the Moments feed (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). Deliberately dependency-free: it is
// imported by the app under Metro and by node:test under
// --experimental-strip-types, and cross-file type imports would need module
// resolution the stripper does not perform.

export interface UnreadCandidate {
  created_at: string;
  user_id: string;
}

// Your own actions never mark your own feed unread, so viewerId is excluded.
// A null stamp means "never read", which makes every other member's event
// unread - correct for a brand-new member.
// created_at values are ISO-8601 UTC strings from Postgres, so lexicographic
// comparison is chronological; an event exactly at the stamp counts as read.
export function countUnreadEvents(
  events: readonly UnreadCandidate[],
  lastReadAt: string | null,
  viewerId: string,
): number {
  return events.filter(
    (event) => event.user_id !== viewerId && (lastReadAt === null || event.created_at > lastReadAt),
  ).length;
}
