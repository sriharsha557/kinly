// Who in the circle needs something from you today, and what you can do
// about it (docs/superpowers/specs/2026-08-01-home-circle-redesign-design.md).
//
// The single definition of all three signals. The Circle screen renders what
// this returns and owns no rules of its own, so "is Sara waterable" cannot
// have two different answers in two different components - which is exactly
// what happened before, with the grace-window rule inlined in BuddyCard.
//
// Dependency-free apart from memberActivity.ts and showingUp.ts, so
// node:test can import it under --experimental-strip-types.

import { EMPTY_ACTIVITY, type MemberActivity } from './memberActivity.ts';

export type AttentionReason = 'streak_at_risk' | 'tough_day' | 'quiet';

export interface AttentionInput {
  members: readonly { userId: string; name: string }[];
  // One row per member, built from the check-in ledger (memberActivity.ts) -
  // not goals.last_logged_date / goals.streak_count, which nothing writes
  // for a cadence commitment.
  activity: ReadonlyMap<string, MemberActivity>;
  // Which goal to water for a member whose streak is at risk. A streak is a
  // member-level fact here (the longest across their goals), but
  // water_streak() still needs one specific goal id, and that choice cannot
  // be recovered from `activity` alone - so the caller builds this from each
  // member's longest-streak goal and hands it in.
  atRiskGoalByMember: Readonly<Record<string, string>>;
  toughToday: readonly string[];
  viewerId: string;
  // Injected rather than read from Date.now() inside, so tests can pin a
  // date instead of computing expectations relative to the day they run.
  now: number;
}

export interface AttentionRow {
  userId: string;
  name: string;
  reason: AttentionReason;
  detail: string;
  // Only set for streak_at_risk - water_streak() needs the specific goal.
  goalId?: string;
}

const DAY_MS = 86_400_000;

// Calendar days between a yyyy-mm-dd date and an instant, both anchored to
// LOCAL midnight.
//
// The obvious version - (now - Date.parse(isoDate)) / DAY_MS, floored - is
// what this used to be, and it drifts with the viewer's timezone: `new
// Date('2026-07-30')` parses as UTC midnight while `now` is a local instant,
// so west of UTC the count ticks over early in the evening and east of it
// late. That made the "water this streak" row appear and disappear by time
// of day, in exactly the evening hours someone would reach for it, and let
// the client disagree with water_streak()'s server-side current_date.
//
// Anchoring both sides to local midnight makes the result a stable count of
// calendar days. Rounding rather than flooring absorbs the 23- and 25-hour
// days that DST transitions produce.
export function calendarDaysSince(isoDate: string, now: number): number {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const then = new Date(year, month - 1, day).getTime();
  const today = new Date(now);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((todayMidnight - then) / DAY_MS);
}

function daysSince(isoDate: string, now: number): number {
  return calendarDaysSince(isoDate, now);
}

// The exact single-day grace window water_streak() enforces server-side.
// Mirrored here only to decide whether to offer the action at all - the RPC
// re-validates everything, so being slightly generous here is safe and being
// wrong here cannot corrupt a streak.
export function isInGraceWindow(lastCheckinDate: string | null, now: number): boolean {
  if (!lastCheckinDate) return false;
  return daysSince(lastCheckinDate, now) === 2;
}

// Ordered most urgent first: an at-risk streak expires today, while a tough
// day and a quiet stretch both keep. Index in this array is the rank.
const REASON_RANK: AttentionReason[] = ['streak_at_risk', 'tough_day', 'quiet'];

export function needsAttention(input: AttentionInput): AttentionRow[] {
  const { members, activity, atRiskGoalByMember, toughToday, viewerId, now } = input;
  const tough = new Set(toughToday);
  const rows: AttentionRow[] = [];

  for (const member of members) {
    if (member.userId === viewerId) continue;

    const summary = activity.get(member.userId) ?? EMPTY_ACTIVITY;

    if (isInGraceWindow(summary.lastCheckinDate, now)) {
      rows.push({
        userId: member.userId,
        name: member.name,
        reason: 'streak_at_risk',
        // A streak used to be one number in one unit - days - so
        // "N-day streak ends today" was always true. Now it is counted in
        // each goal's own periods (days for a daily goal, weeks for a
        // 4x/week one), so no single number and unit can describe every
        // member's at-risk goal correctly. Say only what is true for all of
        // them: the streak ends today, with no number attached.
        detail: 'streak ends today',
        goalId: atRiskGoalByMember[member.userId],
      });
      continue;
    }

    if (tough.has(member.userId)) {
      rows.push({ userId: member.userId, name: member.name, reason: 'tough_day', detail: 'had a tough day' });
      continue;
    }

    // A member who has never checked in is not "quiet" - stageFor()
    // renders them wilted because it has no date to work from, but there is
    // nothing for them to have lapsed from, and prompting the circle to
    // chase someone who joined yesterday is hostile.
    if (summary.lastCheckinDate === null) continue;

    const quietDays = daysSince(summary.lastCheckinDate, now);
    // > 3, not >= 3: this is exactly useGarden.stageFor()'s wilt threshold,
    // and the two must agree or a member shows wilted art in the Members
    // list while being absent from Circle Today.
    if (quietDays > 3) {
      rows.push({
        userId: member.userId,
        name: member.name,
        reason: 'quiet',
        detail: `quiet for ${quietDays} days`,
      });
    }
  }

  return rows.sort((a, b) => REASON_RANK.indexOf(a.reason) - REASON_RANK.indexOf(b.reason));
}
