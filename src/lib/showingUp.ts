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

import { toIsoDate, addDays, startOfWeek, daysRemainingInWeek, isoWeekday, startOfMonth, daysRemainingInMonth } from './periods.ts';

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

function doneThisMonth(done: Set<string>, day: Date): number {
  const prefix = toIsoDate(startOfMonth(day)).slice(0, 7); // YYYY-MM
  let count = 0;
  for (const date of done) {
    if (date.startsWith(prefix)) count += 1;
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
    case 'specific_weekdays': {
      const scheduled = cadence.target_weekdays ?? [];
      const monday = startOfWeek(today);
      const todayWeekday = isoWeekday(today);
      // Strictly earlier than today: a scheduled day that is still in progress
      // is not a miss. Marking someone as failing at 00:01 on the day they
      // planned to act is the judgement this model exists to avoid.
      return scheduled
        .filter((weekday) => weekday < todayWeekday)
        .every((weekday) => done.has(toIsoDate(addDays(monday, weekday - 1))));
    }
    case 'monthly': {
      const target = cadence.target_count ?? 1;
      return doneThisMonth(done, today) + daysRemainingInMonth(today) >= target;
    }
    default:
      return false;
  }
}

// One concept: consecutive successful commitment periods. The period is the
// cadence's own unit, which is why a weekly goal at 12 means twelve weeks
// rather than 84 days - counting days here would silently make weekly goals
// look seven times better than daily ones.
//
// The current period is counted only when it is ALREADY satisfied, and never
// counted against. An unfinished today is not a failure, so a daily streak
// does not collapse to zero every midnight.
export function streak(cadence: Cadence, checkins: CheckinDates, now: number): number {
  const today = new Date(now);
  const done = checkinSet(checkins);

  if (cadence.target_type === 'daily') {
    let count = 0;
    let cursor = done.has(toIsoDate(today)) ? today : addDays(today, -1);
    while (done.has(toIsoDate(cursor))) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  if (cadence.target_type === 'monthly') {
    const target = cadence.target_count ?? 1;
    // A target of zero or less would make `doneThisMonth(...) >= target` true
    // for every month and loop forever. A commitment with nothing to reach
    // is not a commitment, so it has no streak.
    if (target <= 0) return 0;
    let count = 0;
    let cursor = startOfMonth(today);
    if (doneThisMonth(done, cursor) < target) {
      cursor = startOfMonth(addDays(cursor, -1));
    }
    while (doneThisMonth(done, cursor) >= target) {
      count += 1;
      cursor = startOfMonth(addDays(cursor, -1));
    }
    return count;
  }

  // An empty weekday set would make weekMet vacuously true for every week
  // and loop forever. A commitment scheduled for no days has no streak.
  if (cadence.target_type === 'specific_weekdays' && (cadence.target_weekdays ?? []).length === 0) {
    return 0;
  }

  if (cadence.target_type === 'times_per_week') {
    // A target of zero or less would make `doneThisWeek(...) >= target` true
    // for every week and loop forever. A commitment with nothing to reach is
    // not a commitment, so it has no streak.
    const target = cadence.target_count ?? 0;
    if (target <= 0) return 0;
  }

  // An unrecognised target_type falls through to here otherwise, and would
  // be silently treated as times_per_week. isShowingUp refuses to guess at
  // an unknown cadence, so streak does too.
  if (cadence.target_type !== 'times_per_week' && cadence.target_type !== 'specific_weekdays') {
    return 0;
  }

  // Both weekly cadences: walk back a week at a time, asking each week
  // whether it met its own definition of success.
  const weekMet = (weekStart: Date): boolean => {
    if (cadence.target_type === 'specific_weekdays') {
      const scheduled = cadence.target_weekdays ?? [];
      return scheduled.every((weekday) => done.has(toIsoDate(addDays(weekStart, weekday - 1))));
    }
    return doneThisWeek(done, weekStart) >= (cadence.target_count ?? 0);
  };

  let count = 0;
  let cursor = startOfWeek(today);
  if (!weekMet(cursor)) cursor = addDays(cursor, -7);
  while (weekMet(cursor)) {
    count += 1;
    cursor = addDays(cursor, -7);
  }
  return count;
}

// Measured against the goal's OWN cadence, never a fixed /7 - a 4x/week goal
// reading 4/7 would make someone who fully honored their commitment look like
// they had failed three days.
export function consistency(
  cadence: Cadence,
  checkins: CheckinDates,
  now: number,
): { done: number; of: number } {
  const today = new Date(now);
  const done = checkinSet(checkins);

  switch (cadence.target_type) {
    case 'daily':
      return { done: doneThisWeek(done, today), of: 7 };
    case 'times_per_week': {
      const of = cadence.target_count ?? 0;
      return { done: Math.min(doneThisWeek(done, today), of), of };
    }
    case 'specific_weekdays': {
      const scheduled = cadence.target_weekdays ?? [];
      const monday = startOfWeek(today);
      const hit = scheduled.filter((weekday) =>
        done.has(toIsoDate(addDays(monday, weekday - 1))),
      ).length;
      return { done: hit, of: scheduled.length };
    }
    case 'monthly': {
      const of = cadence.target_count ?? 1;
      return { done: Math.min(doneThisMonth(done, today), of), of };
    }
    // An unrecognised target_type would fall through to implicit undefined
    // and crash any caller doing destructuring. A corrupted or legacy database
    // value must not crash a caller, so return a neutral value instead.
    default:
      return { done: 0, of: 0 };
  }
}
