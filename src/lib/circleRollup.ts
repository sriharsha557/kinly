// Circle-level summaries, built from the showing-up primitive. Raw check-in
// counts are never rolled up: every number here counts members who are
// showing up for their OWN cadence.
//
// Lives here rather than in a component so the Circle tab and any later
// surface cannot disagree about what "5 of 7" means - the same reason
// needsAttention.ts owns its rules.

import { isShowingUp, type Cadence, type CheckinDates } from './showingUp.ts';
import { addDays, toIsoDate } from './periods.ts';

export interface RollupGoal extends Cadence {
  id: string;
  user_id: string;
  area_id: string | null;
}

export interface RollupInput {
  areas: readonly { id: string; label: string }[];
  goals: readonly RollupGoal[];
  checkinsByGoal: Record<string, CheckinDates>;
  now: number;
}

export interface AreaRollup {
  areaId: string;
  label: string;
  showingUp: number;
  participating: number;
}

export function areaRollup({ areas, goals, checkinsByGoal, now }: RollupInput): AreaRollup[] {
  return areas.map((area) => {
    // Only members who set a goal in this Area. Someone with no goal is at
    // rest, not behind, so they are absent from both sides of the ratio.
    const inArea = goals.filter((goal) => goal.area_id === area.id);
    const showingUp = inArea.filter((goal) =>
      isShowingUp(goal, checkinsByGoal[goal.id] ?? [], now),
    ).length;
    return { areaId: area.id, label: area.label, showingUp, participating: inArea.length };
  });
}

// Consecutive days on which anyone in the circle checked in - "the circle has
// had activity every day for 86 days."
//
// The spec's majority-threshold version was replaced because nobody can
// answer "why 18?" without reciting a formula. This measures aliveness rather
// than health, which is the honest thing for a headline number in an app with
// no competition. Today not having a check-in yet is not a break.
export function circleActivityStreak(checkinDates: readonly string[], now: number): number {
  const days = new Set(checkinDates.map((d) => d.slice(0, 10)));
  const today = new Date(now);
  let count = 0;
  let cursor = days.has(toIsoDate(today)) ? today : addDays(today, -1);
  while (days.has(toIsoDate(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}
