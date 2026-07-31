// Composes one circle's daily digest (docs/superpowers/specs/2026-07-31-
// notifications-design.md). A curated highlight reel, not an exhaustive
// list: three lines plus an "and N more" tail, chosen in a fixed priority
// order so the biggest moment of the day is always the first line.
//
// Returns null for a day worth nothing - an empty digest is itself noise,
// so no push is sent at all.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface DigestEvent {
  type: string;
  user_id: string;
  actor_name: string;
  payload: Record<string, unknown>;
}

const MAX_LINES = 3;

export function composeDigest(
  events: readonly DigestEvent[],
  activeMemberCount: number,
): string[] | null {
  // Priority order from the spec: streak milestones, goal completions,
  // garden growth, then aggregated check-in participation.
  const streaks = events
    .filter((e) => e.type === 'streak')
    .map((e) => `${e.actor_name} reached a ${e.payload.streak_count ?? 0}-day streak`);

  const completions = events
    .filter((e) => e.type === 'goal_completed')
    .map((e) => `${e.actor_name} completed "${e.payload.title ?? 'a goal'}"`);

  const growth = events
    .filter((e) => e.type === 'garden_grew')
    .map((e) => {
      const stage = e.payload.stage as string | undefined;
      const label = stage === 'bloom' ? 'is blooming' : stage === 'tree' ? 'grew into a tree' : 'sprouted';
      return `${e.actor_name}'s garden ${label}`;
    });

  // Participation is one aggregated line, never one per person - a circle
  // of five checking in is a single fact, not five headlines. Counted by
  // distinct member so a second check-in the same day doesn't inflate it.
  const checkedIn = new Set(events.filter((e) => e.type === 'mood_checkin').map((e) => e.user_id));
  const participation: string[] = [];
  if (checkedIn.size > 0) {
    participation.push(
      checkedIn.size >= activeMemberCount
        ? 'Everyone checked in today 🎉'
        : `${checkedIn.size} friend${checkedIn.size === 1 ? '' : 's'} checked in`,
    );
  }

  const all = [...streaks, ...completions, ...growth, ...participation];
  if (all.length === 0) return null;
  if (all.length <= MAX_LINES) return all;
  return [...all.slice(0, MAX_LINES), `and ${all.length - MAX_LINES} more`];
}
