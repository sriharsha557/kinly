// Calendar primitives shared by every cadence rule in showingUp.ts.
//
// Dependency-free so node:test can import it under --experimental-strip-types.
//
// Everything is anchored to LOCAL midnight, for the reason calendarDaysSince
// in needsAttention.ts documents at length: `new Date('2026-08-05')` parses as
// UTC midnight, so comparing it against a local instant makes results tick
// over at the wrong hour and lets the client disagree with the server's
// current_date. Constructing dates component-wise avoids that entirely.

// ISO-8601. Nothing in the codebase defined a week boundary before this -
// weekly recap works on rolling windows - so this constant establishes one,
// and every weekly rule must read it rather than hardcoding a day.
export const WEEK_STARTS_ON = 1; // Monday

export function toLocalDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// getDay() is 0=Sunday..6=Saturday; ISO is 1=Monday..7=Sunday.
export function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

// Adds whole days via the date component rather than arithmetic on the
// timestamp, so 23- and 25-hour DST days do not shift the clock time.
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfWeek(d: Date): Date {
  return addDays(d, -(isoWeekday(d) - WEEK_STARTS_ON));
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Inclusive of today: someone looking at Wednesday still has Wednesday to
// check in. Every "can they still reach the target" rule depends on this,
// so an off-by-one here marks people as failing a day early.
export function daysRemainingInWeek(d: Date): number {
  return 7 - (isoWeekday(d) - WEEK_STARTS_ON);
}

export function daysRemainingInMonth(d: Date): number {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate() + 1;
}
