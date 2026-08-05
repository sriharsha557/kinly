// "Is this person honoring the commitment they made to themselves?" - the one
// primitive every Areas of Growth surface renders from
// (docs/superpowers/specs/2026-08-05-areas-of-growth-design.md).
//
// Named showing_up, never on_track. "On track" is a judgement the UI must not
// render, and the literal alternatives are false: someone on a 4x/week cadence
// who has not logged Tuesday is honoring their commitment, so counting them
// inside "5/7 checked in" states something that did not happen.
//
// Raw check-in counts are never rolled up. Circle summaries count members who
// are showing up for their OWN cadence, which is what makes a walking goal and
// a gym goal comparable without comparing walking to gym.
//
// Dependency-free apart from periods.ts so node:test can import it under
// --experimental-strip-types.

import { toIsoDate, addDays, startOfWeek, daysRemainingInWeek } from './periods.ts';

export type TargetType = 'daily' | 'times_per_week' | 'specific_weekdays' | 'monthly';

export interface Cadence {
  target_type: TargetType;
  // Set for times_per_week and monthly; null otherwise.
  target_count: number | null;
  // ISO weekdays (1=Mon..7=Sun), set for specific_weekdays; null otherwise.
  target_weekdays: number[] | null;
}

export type CheckinDates = readonly string[];

function checkinSet(checkins: CheckinDates): Set<string> {
  return new Set(checkins.map((d) => d.slice(0, 10)));
}

// Check-ins falling inside the Monday-start week containing `day`.
function doneThisWeek(done: Set<string>, day: Date): number {
  const monday = startOfWeek(day);
  let count = 0;
  for (let i = 0; i < 7; i += 1) {
    if (done.has(toIsoDate(addDays(monday, i)))) count += 1;
  }
  return count;
}

export function isShowingUp(cadence: Cadence, checkins: CheckinDates, now: number): boolean {
  const today = new Date(now);
  const done = checkinSet(checkins);

  switch (cadence.target_type) {
    case 'daily':
      return done.has(toIsoDate(today));
    case 'times_per_week': {
      const target = cadence.target_count ?? 0;
      // Reachability, not completion: the week is not over, so someone who
      // can still hit the target has not broken anything. It flips false only
      // when the arithmetic makes it impossible, and stays false for the rest
      // of that week because no later check-in can change it.
      return doneThisWeek(done, today) + daysRemainingInWeek(today) >= target;
    }
    default:
      return false;
  }
}
