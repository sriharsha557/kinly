// A circle's goals plus its check-in ledger, collapsed to one row per
// member: their best streak, when they last did anything, and how many of
// their commitments they are currently honouring.
//
// This exists because nine different features wanted the same three facts
// and each used to compute them from goals.streak_count and
// goals.last_logged_date - columns the check-in ledger does not write. The
// previous round of that duplication put isInGraceWindow in three separate
// files, which then disagreed.
//
// Dependency-free apart from showingUp.ts, so node:test can import it under
// --experimental-strip-types.

import { isShowingUp, streak, type Cadence, type CheckinDates } from './showingUp.ts';

export interface ActivityGoal extends Cadence {
  id: string;
  user_id: string;
}

export interface MemberActivity {
  bestStreak: number;
  lastCheckinDate: string | null;
  showingUp: number;
  goalCount: number;
}

// The neutral value for a member with no goals. Callers render this instead
// of branching on undefined, because someone who has not set a goal is at
// rest rather than behind, and every surface should say so the same way.
export const EMPTY_ACTIVITY: MemberActivity = {
  bestStreak: 0,
  lastCheckinDate: null,
  showingUp: 0,
  goalCount: 0,
};

// Which goal to offer when a member's streak is about to lapse: the one
// with the most to lose.
//
// This rule used to live inside needsAttention, which picked the at-risk
// goal itself. It moved out when the attention list started reading a
// per-member summary that deliberately carries no goal ids - water-streak
// concerns have no business in a module nine features share. Extracting it
// here rather than inlining it in the screen keeps the rule testable; it
// briefly lived in a component with no tests at all, which is how a product
// decision loses its only guard.
export function longestStreakGoalByMember(
  goals: readonly ActivityGoal[],
  checkinsByGoal: Readonly<Record<string, CheckinDates>>,
  now: number,
): Record<string, string> {
  const best: Record<string, { goalId: string; streak: number }> = {};
  for (const goal of goals) {
    const goalStreak = streak(goal, checkinsByGoal[goal.id] ?? [], now);
    const current = best[goal.user_id];
    if (!current || goalStreak > current.streak) {
      best[goal.user_id] = { goalId: goal.id, streak: goalStreak };
    }
  }
  const byMember: Record<string, string> = {};
  for (const [memberId, entry] of Object.entries(best)) byMember[memberId] = entry.goalId;
  return byMember;
}

export function memberActivity(
  goals: readonly ActivityGoal[],
  checkinsByGoal: Readonly<Record<string, CheckinDates>>,
  now: number,
): Map<string, MemberActivity> {
  const byMember = new Map<string, MemberActivity>();

  for (const goal of goals) {
    const checkins = checkinsByGoal[goal.id] ?? [];
    const current = byMember.get(goal.user_id) ?? { ...EMPTY_ACTIVITY };

    // Streaks are periods in each goal's own cadence, so the max across a
    // member's goals is not comparable in units - but it is the right
    // headline number: it answers "what is the best thing they have going".
    current.bestStreak = Math.max(current.bestStreak, streak(goal, checkins, now));

    for (const date of checkins) {
      const day = date.slice(0, 10);
      if (current.lastCheckinDate === null || day > current.lastCheckinDate) {
        current.lastCheckinDate = day;
      }
    }

    if (isShowingUp(goal, checkins, now)) current.showingUp += 1;
    current.goalCount += 1;

    byMember.set(goal.user_id, current);
  }

  return byMember;
}
