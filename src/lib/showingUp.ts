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

import { toIsoDate } from './periods.ts';

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

export function isShowingUp(cadence: Cadence, checkins: CheckinDates, now: number): boolean {
  const today = new Date(now);
  const done = checkinSet(checkins);

  switch (cadence.target_type) {
    case 'daily':
      return done.has(toIsoDate(today));
    default:
      return false;
  }
}
