# Areas of Growth — Model & Metrics Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cadence-aware commitment schema and the `showingUp` metrics module that every Areas of Growth screen will render from.

**Architecture:** A dependency-free pure TypeScript module (`src/lib/periods.ts`, `src/lib/showingUp.ts`) owns all cadence rules and is unit-tested under `node:test`. Postgres gains the Area catalog, per-circle enablement, a check-in ledger and a commitment archive, plus a SQL view restating the same rules for the two Deno edge functions. A shared JSON fixture set is executed against both implementations so they cannot drift.

**Tech Stack:** TypeScript 5.9, Node's built-in test runner (`node --experimental-strip-types --test`), Supabase/Postgres migrations, Expo 54 / React Native 0.81.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-areas-of-growth-design.md`. Every decision below is drawn from it.
- **Expo version is 54** (`package.json` pins `^54.0.36`), *not* the v57 referenced in `AGENTS.md`. This plan touches no Expo APIs, so the discrepancy does not bite here — but do not "upgrade" anything.
- **Naming: `showing_up` / `isShowingUp`, never `on_track`.** The spec rejects "on track" as a judgement and rejects "checked in" as factually false for non-daily cadences. No identifier, comment, column or string in this plan may use "on track".
- **Weeks start Monday**, ISO-8601. Weekdays are `1`=Monday through `7`=Sunday.
- **All date maths is local-time**, anchored to local midnight — matching `calendarDaysSince` in `src/lib/needsAttention.ts`, which documents why UTC parsing drifts.
- **`now` is always an injected parameter**, never `Date.now()` read inside a function. Tests pin dates.
- **Modules under test must be dependency-free** so `node:test` can import them under `--experimental-strip-types`.
- **Import specifiers in `src/lib` test files use the `.ts` extension** (`from './periods.ts'`), matching `src/lib/daylight.test.ts`.
- Run the suite with `npm test`.
- Commit after every task.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/periods.ts` (create) | Calendar primitives: local-date parsing, ISO weekday, week/month boundaries, days-remaining. No goal knowledge. |
| `src/lib/periods.test.ts` (create) | Unit tests for the above, including DST and year boundaries. |
| `src/lib/showingUp.ts` (create) | The cadence rules: `isShowingUp`, `streak`, `consistency`. Imports only `periods.ts`. |
| `src/lib/showingUp.test.ts` (create) | Unit tests per cadence. |
| `src/lib/showingUp.fixtures.json` (create) | Shared truth table executed by both TS and SQL. |
| `src/lib/showingUp.fixtures.test.ts` (create) | Runs the fixtures against the TS implementation. |
| `scripts/check-showing-up-parity.mjs` (create) | Runs the same fixtures against the SQL view. |
| `supabase/migrations/0046_areas_of_growth.sql` (create) | Catalog, enablement, check-in ledger, archive, `goals` columns, RLS, unique index. |
| `supabase/migrations/0047_areas_backfill.sql` (create) | Maps existing goals to Areas, resolves overflow, seeds `circle_areas`. |
| `supabase/migrations/0048_showing_up_view.sql` (create) | `goal_showing_up` view for the Deno edge functions. |
| `src/types/models.ts` (modify) | `Area`, `TargetType`, `GoalStatus`, `EndedReason`, extended `Goal`. |

Tasks 1–7 are pure TypeScript and can be verified with `npm test` alone. Tasks 8–10 are SQL and are verified by the parity script.

---

### Task 1: Calendar primitives

**Files:**
- Create: `src/lib/periods.ts`
- Test: `src/lib/periods.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `WEEK_STARTS_ON`, `toLocalDate(iso: string): Date`, `toIsoDate(d: Date): string`, `isoWeekday(d: Date): number`, `startOfWeek(d: Date): Date`, `startOfMonth(d: Date): Date`, `daysRemainingInWeek(d: Date): number`, `daysRemainingInMonth(d: Date): number`, `addDays(d: Date, n: number): Date`. Every later task uses these.

- [ ] **Step 1: Write the failing test**

Create `src/lib/periods.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalDate,
  toIsoDate,
  isoWeekday,
  startOfWeek,
  startOfMonth,
  daysRemainingInWeek,
  daysRemainingInMonth,
  addDays,
} from './periods.ts';

// 2026-08-05 is a Wednesday.
const WED = '2026-08-05';

test('toLocalDate anchors to local midnight, not UTC', () => {
  const d = toLocalDate(WED);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 5);
  assert.equal(d.getHours(), 0);
});

test('toIsoDate round-trips toLocalDate', () => {
  assert.equal(toIsoDate(toLocalDate(WED)), WED);
  assert.equal(toIsoDate(toLocalDate('2026-01-01')), '2026-01-01');
});

test('isoWeekday numbers Monday 1 through Sunday 7', () => {
  assert.equal(isoWeekday(toLocalDate('2026-08-03')), 1); // Monday
  assert.equal(isoWeekday(toLocalDate(WED)), 3);
  assert.equal(isoWeekday(toLocalDate('2026-08-09')), 7); // Sunday
});

test('weeks start on Monday', () => {
  assert.equal(toIsoDate(startOfWeek(toLocalDate(WED))), '2026-08-03');
  // Sunday belongs to the week that opened the previous Monday.
  assert.equal(toIsoDate(startOfWeek(toLocalDate('2026-08-09'))), '2026-08-03');
  assert.equal(toIsoDate(startOfWeek(toLocalDate('2026-08-10'))), '2026-08-10');
});

test('daysRemainingInWeek counts today as still available', () => {
  assert.equal(daysRemainingInWeek(toLocalDate('2026-08-03')), 7); // Monday
  assert.equal(daysRemainingInWeek(toLocalDate(WED)), 5);
  assert.equal(daysRemainingInWeek(toLocalDate('2026-08-09')), 1); // Sunday
});

test('month boundaries and remaining days', () => {
  assert.equal(toIsoDate(startOfMonth(toLocalDate(WED))), '2026-08-01');
  assert.equal(daysRemainingInMonth(toLocalDate(WED)), 27); // 5th..31st
  assert.equal(daysRemainingInMonth(toLocalDate('2026-08-31')), 1);
  assert.equal(daysRemainingInMonth(toLocalDate('2026-02-01')), 28);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(toIsoDate(addDays(toLocalDate('2026-08-31'), 1)), '2026-09-01');
  assert.equal(toIsoDate(addDays(toLocalDate('2026-01-01'), -1)), '2025-12-31');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './periods.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/periods.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, all `periods.test.ts` tests green.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/periods.ts src/lib/periods.test.ts
git commit -m "Add local-time calendar primitives with a Monday week start"
```

---

### Task 2: Cadence types and the daily rule

**Files:**
- Create: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: everything from `periods.ts` (Task 1).
- Produces: `TargetType`, `Cadence`, `CheckinDates`, `isShowingUp(cadence: Cadence, checkins: CheckinDates, now: number): boolean`. Tasks 3–7 extend this same file and signature.

`CheckinDates` is `readonly string[]` of `YYYY-MM-DD`. Callers pass only that goal's check-ins; the module never filters by goal id.

- [ ] **Step 1: Write the failing test**

Create `src/lib/showingUp.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isShowingUp, type Cadence } from './showingUp.ts';

// Wednesday 2026-08-05, midday, so nothing depends on the hour.
const WED = new Date(2026, 7, 5, 12).getTime();

const daily: Cadence = { target_type: 'daily', target_count: null, target_weekdays: null };

test('daily is showing up only when today has a check-in', () => {
  assert.equal(isShowingUp(daily, ['2026-08-05'], WED), true);
  assert.equal(isShowingUp(daily, ['2026-08-04'], WED), false);
  assert.equal(isShowingUp(daily, [], WED), false);
});

test('daily ignores future and duplicate check-ins', () => {
  assert.equal(isShowingUp(daily, ['2026-08-06'], WED), false);
  assert.equal(isShowingUp(daily, ['2026-08-05', '2026-08-05'], WED), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './showingUp.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/showingUp.ts`:

```ts
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

import { toIsoDate, toLocalDate, isoWeekday, startOfWeek, daysRemainingInWeek } from './periods.ts';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Add the showing-up primitive with the daily cadence"
```

---

### Task 3: The `times_per_week` rule

**Files:**
- Modify: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: `isShowingUp`, `Cadence` (Task 2); `startOfWeek`, `daysRemainingInWeek`, `addDays` (Task 1).
- Produces: no new exports — extends `isShowingUp`.

The rule: showing up stays true while the target is still arithmetically reachable — `done + daysRemainingInWeek >= target_count` — and turns false for the remainder of the week once it is not.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/showingUp.test.ts`:

```ts
const fourPerWeek: Cadence = {
  target_type: 'times_per_week',
  target_count: 4,
  target_weekdays: null,
};

// Week of Mon 2026-08-03 .. Sun 2026-08-09.
test('times_per_week stays true while the target is still reachable', () => {
  // Wednesday, nothing logged: 0 done + 5 days left >= 4. Still fine.
  assert.equal(isShowingUp(fourPerWeek, [], WED), true);
  // The gym case from the spec: 4x/week, no check-in today, still honoring it.
  assert.equal(isShowingUp(fourPerWeek, ['2026-08-03', '2026-08-04'], WED), true);
});

test('times_per_week turns false once the target is unreachable', () => {
  // Friday: 0 done, 3 days left (Fri/Sat/Sun) < 4. Impossible.
  const FRI = new Date(2026, 7, 7, 12).getTime();
  assert.equal(isShowingUp(fourPerWeek, [], FRI), false);
  // Same Friday but 1 logged: 1 + 3 = 4. Exactly reachable.
  assert.equal(isShowingUp(fourPerWeek, ['2026-08-03'], FRI), true);
});

test('times_per_week stays true once the target is already met', () => {
  const SUN = new Date(2026, 7, 9, 12).getTime();
  const met = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'];
  assert.equal(isShowingUp(fourPerWeek, met, SUN), true);
});

test('times_per_week counts only the current week', () => {
  // Four check-ins, all in the previous week.
  const lastWeek = ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30'];
  const SUN = new Date(2026, 7, 9, 12).getTime();
  assert.equal(isShowingUp(fourPerWeek, lastWeek, SUN), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the `default: return false` branch makes every `times_per_week` assertion expecting `true` fail.

- [ ] **Step 3: Write the implementation**

In `src/lib/showingUp.ts`, add this helper above `isShowingUp`:

```ts
// Check-ins falling inside the Monday-start week containing `day`.
function doneThisWeek(done: Set<string>, day: Date): number {
  const monday = startOfWeek(day);
  let count = 0;
  for (let i = 0; i < 7; i += 1) {
    if (done.has(toIsoDate(addDays(monday, i)))) count += 1;
  }
  return count;
}
```

Add `addDays` to the existing `periods.ts` import, then replace the `default` branch of the switch with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Add the times-per-week cadence, true while the target is reachable"
```

---

### Task 4: The `specific_weekdays` rule

**Files:**
- Modify: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: as Task 3, plus `isoWeekday`.
- Produces: no new exports.

The rule: every scheduled weekday that has **already elapsed** this week has a check-in. Today is not elapsed — the day is not over.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/showingUp.test.ts`:

```ts
// Mon / Wed / Fri.
const mwf: Cadence = {
  target_type: 'specific_weekdays',
  target_count: null,
  target_weekdays: [1, 3, 5],
};

test('specific_weekdays ignores today - the day is not over', () => {
  // Wednesday is scheduled and unlogged, but Monday was done.
  assert.equal(isShowingUp(mwf, ['2026-08-03'], WED), true);
});

test('specific_weekdays fails on a missed earlier scheduled day', () => {
  // Monday scheduled and missed.
  assert.equal(isShowingUp(mwf, [], WED), false);
});

test('specific_weekdays ignores unscheduled days', () => {
  const THU = new Date(2026, 7, 6, 12).getTime();
  // Mon and Wed both done; Thursday is not scheduled, so nothing is owed.
  assert.equal(isShowingUp(mwf, ['2026-08-03', '2026-08-05'], THU), true);
  // Tuesday check-in does not substitute for the missed Monday.
  assert.equal(isShowingUp(mwf, ['2026-08-04', '2026-08-05'], THU), false);
});

test('specific_weekdays is trivially true on the week s first scheduled day', () => {
  const MON = new Date(2026, 7, 3, 12).getTime();
  assert.equal(isShowingUp(mwf, [], MON), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — all four assertions expecting `true` return `false` from the `default` branch.

- [ ] **Step 3: Write the implementation**

Replace the `default` branch with:

```ts
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
    default:
      return false;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Add the specific-weekdays cadence, judging only elapsed days"
```

---

### Task 5: The `monthly` rule

**Files:**
- Modify: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: `startOfMonth`, `daysRemainingInMonth` (Task 1).
- Produces: no new exports. After this task `isShowingUp` handles all four cadences and the `default` branch is unreachable for valid input.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/showingUp.test.ts`:

```ts
const monthly: Cadence = { target_type: 'monthly', target_count: 2, target_weekdays: null };

test('monthly is true while the target is still reachable', () => {
  assert.equal(isShowingUp(monthly, [], WED), true); // 27 days left, needs 2
  assert.equal(isShowingUp(monthly, ['2026-08-01'], WED), true);
});

test('monthly is true once the target is met', () => {
  const LAST = new Date(2026, 7, 31, 12).getTime();
  assert.equal(isShowingUp(monthly, ['2026-08-01', '2026-08-02'], LAST), true);
});

test('monthly turns false when the month runs out', () => {
  const LAST = new Date(2026, 7, 31, 12).getTime();
  // 0 done, 1 day left, needs 2. Impossible.
  assert.equal(isShowingUp(monthly, [], LAST), false);
  // 1 done, 1 day left, needs 2. Exactly reachable.
  assert.equal(isShowingUp(monthly, ['2026-08-01'], LAST), true);
});

test('monthly counts only the current month', () => {
  assert.equal(isShowingUp(monthly, ['2026-07-01', '2026-07-02'], WED), true); // reachable anyway
  const LAST = new Date(2026, 7, 31, 12).getTime();
  assert.equal(isShowingUp(monthly, ['2026-07-01', '2026-07-02'], LAST), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — assertions expecting `true` hit the `default` branch.

- [ ] **Step 3: Write the implementation**

Add `startOfMonth` and `daysRemainingInMonth` to the `periods.ts` import. Add this helper beside `doneThisWeek`:

```ts
function doneThisMonth(done: Set<string>, day: Date): number {
  const prefix = toIsoDate(startOfMonth(day)).slice(0, 7); // YYYY-MM
  let count = 0;
  for (const date of done) {
    if (date.startsWith(prefix)) count += 1;
  }
  return count;
}
```

Replace the `default` branch with:

```ts
    case 'monthly': {
      const target = cadence.target_count ?? 1;
      return doneThisMonth(done, today) + daysRemainingInMonth(today) >= target;
    }
    default:
      return false;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Add the monthly cadence"
```

---

### Task 6: Streaks counted in periods

**Files:**
- Modify: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: `Cadence`, `CheckinDates`, `doneThisWeek`, `doneThisMonth` (Tasks 2–5).
- Produces: `streak(cadence: Cadence, checkins: CheckinDates, now: number): number`.

Counts consecutive **successful periods** — days for `daily`, weeks for both weekly cadences, months for `monthly`. Rendered 🔥N where N is periods, so a weekly goal at 🔥12 means twelve weeks, not 84 days.

The current period counts only if it is *already* satisfied; an unsatisfied current period does not break the streak, because it is not over. A daily streak must not reset at midnight merely because today has not happened yet.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/showingUp.test.ts`:

```ts
import { isShowingUp, streak, type Cadence } from './showingUp.ts'; // update the existing import

test('daily streak counts consecutive days back from today', () => {
  assert.equal(streak(daily, ['2026-08-05', '2026-08-04', '2026-08-03'], WED), 3);
});

test('daily streak survives a today that has not happened yet', () => {
  // Nothing logged today; yesterday and the day before were done. Today is
  // not a miss until it ends, so the streak is 2, not 0.
  assert.equal(streak(daily, ['2026-08-04', '2026-08-03'], WED), 2);
});

test('daily streak resets on a missed day', () => {
  assert.equal(streak(daily, ['2026-08-05', '2026-08-03'], WED), 1);
  assert.equal(streak(daily, [], WED), 0);
});

test('weekly streak counts weeks, not days', () => {
  // 4x in each of the two previous weeks; current week incomplete.
  const checkins = [
    '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', // week of Jul 27
    '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', // week of Jul 20
  ];
  assert.equal(streak(fourPerWeek, checkins, WED), 2);
});

test('weekly streak includes the current week once already met', () => {
  const checkins = [
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-05', // dupes ignored
    '2026-08-01', // previous week, only 1 - not a success
  ];
  // Current week has 3 distinct, target is 4, so not yet met: streak 0.
  assert.equal(streak(fourPerWeek, checkins, WED), 0);
});

test('specific_weekdays streak counts fully satisfied weeks', () => {
  const checkins = [
    '2026-07-27', '2026-07-29', '2026-07-31', // Mon/Wed/Fri, complete
    '2026-07-20', '2026-07-22', // Fri missing, breaks it
  ];
  assert.equal(streak(mwf, checkins, WED), 1);
});

test('monthly streak counts months', () => {
  const checkins = ['2026-07-01', '2026-07-02', '2026-06-01', '2026-06-02'];
  assert.equal(streak(monthly, checkins, WED), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `streak is not exported` / not a function.

- [ ] **Step 3: Write the implementation**

Add to `src/lib/showingUp.ts` (import `addDays`, `startOfMonth`, `startOfWeek` are already present):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Count streaks in commitment periods rather than days"
```

---

### Task 7: Consistency against the goal's own denominator

**Files:**
- Modify: `src/lib/showingUp.ts`
- Test: `src/lib/showingUp.test.ts`

**Interfaces:**
- Consumes: `doneThisWeek`, `doneThisMonth`.
- Produces: `consistency(cadence: Cadence, checkins: CheckinDates, now: number): { done: number; of: number }`.

**Deliberate refinement of the spec:** the spec calls this "weekly consistency", but a monthly goal has no meaningful weekly denominator. The function reports the **current period** of the goal's own cadence — weekly for daily and both weekly cadences, monthly for monthly — so the rendered figure is `5/7`, `4/4` or `2/2` and never a fixed `/7`. Callers label it "this week" except for monthly goals.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/showingUp.test.ts`, updating the import to include `consistency`:

```ts
test('daily consistency is out of seven', () => {
  assert.deepEqual(consistency(daily, ['2026-08-03', '2026-08-04'], WED), { done: 2, of: 7 });
});

test('times_per_week consistency is out of its own target', () => {
  assert.deepEqual(consistency(fourPerWeek, ['2026-08-03', '2026-08-04'], WED), { done: 2, of: 4 });
});

test('specific_weekdays consistency is out of the scheduled count', () => {
  assert.deepEqual(consistency(mwf, ['2026-08-03'], WED), { done: 1, of: 3 });
});

test('specific_weekdays consistency counts only scheduled days', () => {
  // Tuesday is not scheduled and must not count toward 1/3.
  assert.deepEqual(consistency(mwf, ['2026-08-04'], WED), { done: 0, of: 3 });
});

test('monthly consistency reports the month', () => {
  assert.deepEqual(consistency(monthly, ['2026-08-01'], WED), { done: 1, of: 2 });
});

test('consistency never exceeds its denominator', () => {
  const many = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
  assert.deepEqual(consistency(fourPerWeek, many, WED), { done: 4, of: 4 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `consistency is not exported`.

- [ ] **Step 3: Write the implementation**

```ts
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
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. All of `showingUp.test.ts` and `periods.test.ts` green.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/showingUp.ts src/lib/showingUp.test.ts
git commit -m "Report consistency against each goal's own denominator"
```

---

### Task 8: Schema — catalog, enablement, ledger, archive

**Files:**
- Create: `supabase/migrations/0046_areas_of_growth.sql`
- Modify: `src/types/models.ts`

**Interfaces:**
- Consumes: `TargetType` from `showingUp.ts` (Task 2) — `models.ts` re-exports it rather than redeclaring.
- Produces: tables `areas`, `circle_areas`, `goal_checkins`, `goal_history`; columns on `goals`; TS types `Area`, `GoalStatus`, `EndedReason`, extended `Goal`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0046_areas_of_growth.sql`:

```sql
-- Areas of Growth: per-member commitments grouped under a shared, curated
-- Area catalog (docs/superpowers/specs/2026-08-05-areas-of-growth-design.md).
--
-- Goals were always per-member (goals.user_id, since 0001). What was missing
-- was cadence, a per-day check-in ledger and an archive, so goals is evolved
-- in place - five tables and ~45 files reference goals.id, and renaming it
-- would orphan feed entries that are years of a circle's memory.

-- ---------------------------------------------------------------------------
-- areas: the curated catalog. Members cannot create Areas, and that is
-- enforced here rather than only in the UI - there is deliberately no insert,
-- update or delete policy on this table.
-- ---------------------------------------------------------------------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  emoji text not null,
  sort_order integer not null
);

insert into areas (key, label, emoji, sort_order) values
  ('health',     'Health',     '❤️',   1),
  ('mind',       'Mind',       '🧠',   2),
  ('learning',   'Learning',   '📚',   3),
  ('finance',    'Finance',    '💰',   4),
  ('career',     'Career',     '💼',   5),
  ('family',     'Family',     '👨‍👩‍👧', 6),
  ('creativity', 'Creativity', '🎨',   7),
  ('community',  'Community',  '🌍',   8);

-- ---------------------------------------------------------------------------
-- circle_areas: which Areas a circle has turned on. Disabling an Area drops
-- it from rollups and leaves its goals dormant - it must never archive them.
-- Destroying members' commitments as a side effect of a settings toggle would
-- be the most damaging action in the app.
-- ---------------------------------------------------------------------------
create table circle_areas (
  circle_id uuid not null references circles (id) on delete cascade,
  area_id uuid not null references areas (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (circle_id, area_id)
);

-- ---------------------------------------------------------------------------
-- goals, evolved into a commitment
-- ---------------------------------------------------------------------------
alter table goals add column area_id uuid references areas (id);
alter table goals add column target_type text
  check (target_type in ('daily', 'times_per_week', 'specific_weekdays', 'monthly'));
alter table goals add column target_count integer;
alter table goals add column target_weekdays integer[];
alter table goals add column status text not null default 'active'
  check (status in ('active', 'ended'));
alter table goals add column started_at date not null default current_date;
alter table goals add column ended_at date;
alter table goals add column ended_reason text
  check (ended_reason in ('replaced', 'migration', 'deleted', 'completed'));
-- 'habit' today. Challenges, reading plans, savings plans and training plans
-- are all commitments and can later share this table rather than each
-- inventing a parallel one.
alter table goals add column kind text not null default 'habit';

-- One active goal per member per Area. deleted_at participates because this
-- app soft-deletes (0019) and a deleted goal must not block its replacement.
create unique index goals_one_active_per_area
  on goals (circle_id, user_id, area_id)
  where status = 'active' and deleted_at is null;

-- ---------------------------------------------------------------------------
-- goal_checkins: the "done" ledger. One row per goal per day.
-- ---------------------------------------------------------------------------
create table goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  -- Makes check-in idempotent: a double tap, an offline replay and a device
  -- re-sync cannot inflate a streak.
  unique (goal_id, checkin_date)
);

create index goal_checkins_goal_date on goal_checkins (goal_id, checkin_date desc);

-- ---------------------------------------------------------------------------
-- goal_history: the archive. The goals row is NOT deleted when a commitment
-- ends - it is marked status='ended' - because events, streak_saves, buddy
-- check-ins, challenges and the life timeline all hold goal_id. This table is
-- the denormalized summary, including best_streak, which the live row does
-- not retain after a reset.
-- ---------------------------------------------------------------------------
create table goal_history (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals (id) on delete set null,
  circle_id uuid not null references circles (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  area_id uuid references areas (id),
  title text not null,
  target_type text,
  target_count integer,
  target_weekdays integer[],
  started_at date,
  ended_at date not null default current_date,
  best_streak integer not null default 0,
  ended_reason text not null
    check (ended_reason in ('replaced', 'migration', 'deleted', 'completed')),
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

create index goal_history_member on goal_history (circle_id, user_id, area_id);

-- ---------------------------------------------------------------------------
-- RLS, mirroring the circle-scoped pattern established in 0001
-- ---------------------------------------------------------------------------
alter table areas enable row level security;
alter table circle_areas enable row level security;
alter table goal_checkins enable row level security;
alter table goal_history enable row level security;

create policy "the area catalog is readable by everyone signed in" on areas
  for select using (auth.uid() is not null);

create policy "members read their circle's areas" on circle_areas
  for select using (is_circle_member(circle_id));

create policy "owners and admins manage circle areas" on circle_areas
  for all using (
    exists (
      select 1 from circle_members
      where circle_id = circle_areas.circle_id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "members read circle check-ins" on goal_checkins
  for select using (
    exists (select 1 from goals g where g.id = goal_checkins.goal_id and is_circle_member(g.circle_id))
  );

create policy "members check in for themselves" on goal_checkins
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from goals g where g.id = goal_id and g.user_id = auth.uid())
  );

create policy "members undo their own check-in" on goal_checkins
  for delete using (user_id = auth.uid());

create policy "members read circle goal history" on goal_history
  for select using (is_circle_member(circle_id));

create policy "members archive their own goals" on goal_history
  for insert with check (user_id = auth.uid() and is_circle_member(circle_id));
```

- [ ] **Step 2: Verify the migration applies**

Run: `npx supabase db reset`
Expected: every migration applies in order, ending with `0046_areas_of_growth.sql`, no errors. If the local Supabase stack is not running, start it with `npx supabase start` first.

- [ ] **Step 3: Add the TypeScript types**

In `src/types/models.ts`, add near the existing `Goal` interface:

```ts
import type { TargetType } from '../lib/showingUp';

export type { TargetType };

export type AreaKey =
  | 'health' | 'mind' | 'learning' | 'finance'
  | 'career' | 'family' | 'creativity' | 'community';

export interface Area {
  id: string;
  key: AreaKey;
  label: string;
  emoji: string;
  sort_order: number;
}

export type GoalStatus = 'active' | 'ended';
export type EndedReason = 'replaced' | 'migration' | 'deleted' | 'completed';

export interface GoalCheckin {
  id: string;
  goal_id: string;
  user_id: string;
  checkin_date: string;
  created_at: string;
}

export interface GoalHistoryEntry {
  id: string;
  goal_id: string | null;
  circle_id: string;
  user_id: string;
  area_id: string | null;
  title: string;
  target_type: TargetType | null;
  started_at: string | null;
  ended_at: string;
  best_streak: number;
  ended_reason: EndedReason;
  needs_review: boolean;
}
```

Extend the existing `Goal` interface with:

```ts
  area_id: string | null;
  target_type: TargetType | null;
  target_count: number | null;
  target_weekdays: number[] | null;
  status: GoalStatus;
  started_at: string;
  ended_at: string | null;
  ended_reason: EndedReason | null;
  kind: string;
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `Goal.target` and `Goal.progress` stay for now — Plan 3 removes them when step sync is rewritten.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0046_areas_of_growth.sql src/types/models.ts
git commit -m "Add the Area catalog, check-in ledger and commitment archive"
```

---

### Task 9: Backfill existing goals into Areas

**Files:**
- Create: `supabase/migrations/0047_areas_backfill.sql`

**Interfaces:**
- Consumes: every table from Task 8.
- Produces: no new schema — data only. After it, every non-deleted goal has an `area_id` and a `target_type`, or lives in `goal_history` flagged `needs_review`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0047_areas_backfill.sql`:

```sql
-- Backfill: map existing goals onto Areas, resolve the rows that violate the
-- new one-active-goal-per-Area rule, and enable a starting set of Areas per
-- circle. Nothing is deleted. Anything that cannot be mapped cleanly is
-- flagged needs_review rather than dropped.

-- 1. Map the old five-pillar category onto the new eight Areas.
update goals g
set area_id = a.id
from areas a
where g.deleted_at is null
  and g.area_id is null
  and a.key = case g.category
    when 'health'        then 'health'
    when 'wealth'        then 'finance'
    when 'ideas'         then 'creativity'
    when 'learning'      then 'learning'
    when 'relationships' then 'family'
  end;

-- 2. Goals with no category, or 'misc', have no honest mapping. Archive them
-- for review instead of guessing - a wrong Area is worse than a flagged one.
insert into goal_history (
  goal_id, circle_id, user_id, area_id, title, target_type,
  started_at, ended_at, best_streak, ended_reason, needs_review
)
select g.id, g.circle_id, g.user_id, null, g.title, null,
       g.created_at::date, current_date, g.streak_count, 'migration', true
from goals g
where g.deleted_at is null and g.area_id is null and g.status = 'active';

update goals
set status = 'ended', ended_at = current_date, ended_reason = 'migration'
where deleted_at is null and area_id is null and status = 'active';

-- 3. One active goal per (user, area). Keep the one the person actually
-- engaged with most recently; archive the rest for review. Ordering puts
-- nulls last so a never-logged goal never wins over a logged one.
with ranked as (
  select id,
         row_number() over (
           partition by circle_id, user_id, area_id
           order by last_logged_date desc nulls last, created_at desc
         ) as rank
  from goals
  where deleted_at is null and status = 'active' and area_id is not null
),
overflow as (
  select g.* from goals g join ranked r on r.id = g.id where r.rank > 1
)
insert into goal_history (
  goal_id, circle_id, user_id, area_id, title, target_type,
  started_at, ended_at, best_streak, ended_reason, needs_review
)
select o.id, o.circle_id, o.user_id, o.area_id, o.title, 'daily',
       o.created_at::date, current_date, o.streak_count, 'migration', true
from overflow o;

update goals
set status = 'ended', ended_at = current_date, ended_reason = 'migration'
where id in (
  select id from (
    select id, row_number() over (
      partition by circle_id, user_id, area_id
      order by last_logged_date desc nulls last, created_at desc
    ) as rank
    from goals
    where deleted_at is null and status = 'active' and area_id is not null
  ) r where r.rank > 1
);

-- 4. Every surviving goal becomes daily, starting today. started_at is the
-- migration date on purpose: no goal has per-day history to reconstruct
-- (log_goal_progress only ever kept a single last_logged_date), so evaluating
-- showing-up over the past would show a wall of retroactive misses on goals
-- that were never daily to begin with. streak_count is preserved as-is.
update goals
set target_type = 'daily', started_at = current_date
where deleted_at is null and status = 'active' and target_type is null;

-- 5. Seed each circle with Health, Learning and Finance, plus any Area its
-- members are already using.
insert into circle_areas (circle_id, area_id)
select c.id, a.id
from circles c cross join areas a
where a.key in ('health', 'learning', 'finance')
on conflict do nothing;

insert into circle_areas (circle_id, area_id)
select distinct g.circle_id, g.area_id
from goals g
where g.area_id is not null and g.status = 'active'
on conflict do nothing;
```

- [ ] **Step 2: Verify against seeded data**

Run: `npx supabase db reset`
Expected: applies cleanly. Then verify the invariant the unique index depends on:

```bash
npx supabase db execute --sql "select count(*) as violations from (select circle_id, user_id, area_id, count(*) c from goals where status='active' and deleted_at is null group by 1,2,3 having count(*) > 1) x;"
```
Expected: `violations = 0`.

And confirm nothing was lost:

```bash
npx supabase db execute --sql "select ended_reason, needs_review, count(*) from goal_history group by 1,2;"
```
Expected: only `migration` rows, some flagged `needs_review = true`. No goal disappeared — `select count(*) from goals` is unchanged from before the migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0047_areas_backfill.sql
git commit -m "Backfill existing goals into Areas, flagging what cannot be mapped"
```

---

### Task 10: SQL parity for the edge functions

**Files:**
- Create: `supabase/migrations/0048_showing_up_view.sql`
- Create: `src/lib/showingUp.fixtures.json`
- Create: `src/lib/showingUp.fixtures.test.ts`
- Create: `scripts/check-showing-up-parity.mjs`

**Interfaces:**
- Consumes: `isShowingUp` (Tasks 2–5), tables from Task 8.
- Produces: view `goal_showing_up (goal_id, user_id, circle_id, area_id, showing_up)`, consumed later by `daily-digest` and `check-streaks-at-risk` in Plan 3.

The same rule now exists in two languages. The fixtures are the only thing keeping them honest, so they are written **before** the view.

- [ ] **Step 1: Write the fixture set**

Create `src/lib/showingUp.fixtures.json`. Each case is `(cadence, checkins, today, expected)`:

```json
[
  { "name": "daily done today", "target_type": "daily", "target_count": null, "target_weekdays": null,
    "checkins": ["2026-08-05"], "today": "2026-08-05", "expected": true },
  { "name": "daily missed today", "target_type": "daily", "target_count": null, "target_weekdays": null,
    "checkins": ["2026-08-04"], "today": "2026-08-05", "expected": false },
  { "name": "weekly still reachable", "target_type": "times_per_week", "target_count": 4, "target_weekdays": null,
    "checkins": ["2026-08-03", "2026-08-04"], "today": "2026-08-05", "expected": true },
  { "name": "weekly unreachable", "target_type": "times_per_week", "target_count": 4, "target_weekdays": null,
    "checkins": [], "today": "2026-08-07", "expected": false },
  { "name": "weekly exactly reachable", "target_type": "times_per_week", "target_count": 4, "target_weekdays": null,
    "checkins": ["2026-08-03"], "today": "2026-08-07", "expected": true },
  { "name": "weekdays today not yet elapsed", "target_type": "specific_weekdays", "target_count": null, "target_weekdays": [1, 3, 5],
    "checkins": ["2026-08-03"], "today": "2026-08-05", "expected": true },
  { "name": "weekdays missed monday", "target_type": "specific_weekdays", "target_count": null, "target_weekdays": [1, 3, 5],
    "checkins": [], "today": "2026-08-05", "expected": false },
  { "name": "monthly reachable", "target_type": "monthly", "target_count": 2, "target_weekdays": null,
    "checkins": [], "today": "2026-08-05", "expected": true },
  { "name": "monthly out of days", "target_type": "monthly", "target_count": 2, "target_weekdays": null,
    "checkins": [], "today": "2026-08-31", "expected": false },
  { "name": "monthly met", "target_type": "monthly", "target_count": 2, "target_weekdays": null,
    "checkins": ["2026-08-01", "2026-08-02"], "today": "2026-08-31", "expected": true }
]
```

- [ ] **Step 2: Run the fixtures against TypeScript**

Create `src/lib/showingUp.fixtures.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isShowingUp, type Cadence } from './showingUp.ts';

// The same table runs against the SQL view via
// scripts/check-showing-up-parity.mjs. One rule in two languages is a drift
// risk; this file and that script are what turn drift into a failing test
// rather than a digest that quietly lies to people.
interface Fixture extends Cadence {
  name: string;
  checkins: string[];
  today: string;
  expected: boolean;
}

const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL('./showingUp.fixtures.json', import.meta.url), 'utf8'),
);

for (const fixture of fixtures) {
  test(`fixture: ${fixture.name}`, () => {
    const [y, m, d] = fixture.today.split('-').map(Number);
    const now = new Date(y, m - 1, d, 12).getTime();
    assert.equal(isShowingUp(fixture, fixture.checkins, now), fixture.expected);
  });
}
```

Run: `npm test`
Expected: PASS — 10 fixture tests green. If any fail, the fixture is wrong or Tasks 2–5 have a bug; fix before writing SQL.

- [ ] **Step 3: Write the SQL rule as a date-injectable function, plus the view**

The rule goes in a function taking the day as a parameter, not a view reading
`current_date` directly. That is the only way the parity script can test
month-end and unreachable-week cases without waiting for the calendar to reach
them. The view is then a thin caller — one implementation of the rule in SQL,
not two.

Create `supabase/migrations/0048_showing_up_view.sql`:

```sql
-- The showing-up rule restated in SQL for the Deno edge functions
-- (daily-digest, check-streaks-at-risk), which cannot import src/lib.
--
-- This is a second implementation of rules that live in src/lib/showingUp.ts.
-- scripts/check-showing-up-parity.mjs runs the shared fixture table against
-- both; if they drift, that fails rather than a digest silently misreporting
-- to everyone in the circle.
--
-- Weeks start Monday, matching WEEK_STARTS_ON in src/lib/periods.ts.
-- date_trunc('week', ...) is already Monday-based in Postgres, which is why
-- the two agree. Do not change one without the other.

create or replace function showing_up_at(
  p_target_type text,
  p_target_count integer,
  p_target_weekdays integer[],
  p_checkins date[],
  p_day date
) returns boolean
language sql
immutable
as $$
  select case p_target_type
    when 'daily' then p_day = any(coalesce(p_checkins, '{}'::date[]))
    -- 7 - (isodow - 1) is daysRemainingInWeek, inclusive of today.
    when 'times_per_week' then
      (select count(*) from unnest(coalesce(p_checkins, '{}'::date[])) d
        where d >= date_trunc('week', p_day)::date
          and d <  date_trunc('week', p_day)::date + 7)
      + (7 - (extract(isodow from p_day)::int - 1)) >= coalesce(p_target_count, 0)
    -- Strictly earlier than today: a scheduled day still in progress is not
    -- a miss.
    when 'specific_weekdays' then not exists (
      select 1 from unnest(coalesce(p_target_weekdays, '{}'::int[])) as weekday
      where weekday < extract(isodow from p_day)::int
        and date_trunc('week', p_day)::date + (weekday - 1)
            <> all(coalesce(p_checkins, '{}'::date[]))
    )
    when 'monthly' then
      (select count(*) from unnest(coalesce(p_checkins, '{}'::date[])) d
        where d >= date_trunc('month', p_day)::date
          and d <  (date_trunc('month', p_day) + interval '1 month')::date)
      + ((date_trunc('month', p_day) + interval '1 month')::date - p_day)
      >= coalesce(p_target_count, 1)
    else false
  end;
$$;

create or replace view goal_showing_up as
select g.id as goal_id, g.user_id, g.circle_id, g.area_id,
       showing_up_at(
         g.target_type, g.target_count, g.target_weekdays,
         (select array_agg(c.checkin_date) from goal_checkins c where c.goal_id = g.id),
         current_date
       ) as showing_up
from goals g
where g.status = 'active' and g.deleted_at is null;

grant execute on function showing_up_at(text, integer, integer[], date[], date) to authenticated, service_role;
grant select on goal_showing_up to authenticated, service_role;
```

- [ ] **Step 4: Write and run the parity check**

Create `scripts/check-showing-up-parity.mjs`:

```js
// Runs the shared fixture table against the SQL view by materializing each
// case as a temporary goal + check-ins, pinning current_date, and comparing
// the view's answer to the fixture's expected value.
//
// Usage: node scripts/check-showing-up-parity.mjs
// Requires a running local Supabase (npx supabase start).

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const fixtures = JSON.parse(readFileSync(new URL('../src/lib/showingUp.fixtures.json', import.meta.url), 'utf8'));

function sql(statement) {
  return execFileSync('npx', ['supabase', 'db', 'execute', '--sql', statement], {
    encoding: 'utf8',
  });
}

let failures = 0;
for (const fixture of fixtures) {
  const weekdays = fixture.target_weekdays ? `'{${fixture.target_weekdays.join(',')}}'::int[]` : 'null';
  const checkins = fixture.checkins.map((d) => `('${d}'::date)`).join(',') || null;
  // current_date is pinned per case by evaluating the same expressions the
  // view uses against the fixture's `today` rather than the wall clock.
  const query = `
    with cadence as (
      select '${fixture.target_type}'::text as target_type,
             ${fixture.target_count ?? 'null'}::int as target_count,
             ${weekdays} as target_weekdays,
             '${fixture.today}'::date as today
    ),
    c(checkin_date) as (${checkins ? `values ${checkins}` : 'select null::date where false'})
    select showing_up_at(
      (select target_type from cadence),
      (select target_count from cadence),
      (select target_weekdays from cadence),
      (select array_agg(checkin_date) from c),
      (select today from cadence)
    ) as showing_up;`;
  const output = sql(query);
  const got = /\bt\b/.test(output);
  if (got !== fixture.expected) {
    console.error(`PARITY FAIL: ${fixture.name} — SQL said ${got}, expected ${fixture.expected}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} parity failure(s): showingUp.ts and goal_showing_up disagree.`);
  process.exit(1);
}
console.log(`All ${fixtures.length} fixtures agree between TypeScript and SQL.`);
```

Run: `npx supabase db reset && node scripts/check-showing-up-parity.mjs`
Expected: `All 10 fixtures agree between TypeScript and SQL.`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0048_showing_up_view.sql src/lib/showingUp.fixtures.json src/lib/showingUp.fixtures.test.ts scripts/check-showing-up-parity.mjs
git commit -m "Restate the showing-up rule in SQL, bound to TypeScript by shared fixtures"
```

---

### Task 11: Circle rollups

**Files:**
- Create: `src/lib/circleRollup.ts`
- Test: `src/lib/circleRollup.test.ts`

**Interfaces:**
- Consumes: `isShowingUp`, `Cadence` (Tasks 2–5).
- Produces: `areaRollup(input: RollupInput): AreaRollup[]` and `circleActivityStreak(checkinDates: readonly string[], now: number): number`. Plan 2's Circle tab renders both.

Two rules from spec §4 that must not be reinvented in a component:

1. Members **without** a goal in an Area are excluded from the denominator, never counted as failing. Otherwise enabling an Area visibly damages the circle's numbers, penalising the opt-in the design calls neutral.
2. The circle streak is **consecutive days with any check-in from anyone** — no majority threshold. `CIRCLE_STREAK_MAJORITY` is deliberately not implemented.

- [ ] **Step 1: Write the failing test**

Create `src/lib/circleRollup.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaRollup, circleActivityStreak } from './circleRollup.ts';

const WED = new Date(2026, 7, 5, 12).getTime();

const areas = [{ id: 'a1', label: 'Health' }, { id: 'a2', label: 'Learning' }];

test('rollup counts members showing up over members with a goal', () => {
  const rows = areaRollup({
    areas,
    goals: [
      { id: 'g1', user_id: 'u1', area_id: 'a1', target_type: 'daily', target_count: null, target_weekdays: null },
      { id: 'g2', user_id: 'u2', area_id: 'a1', target_type: 'daily', target_count: null, target_weekdays: null },
    ],
    checkinsByGoal: { g1: ['2026-08-05'], g2: [] },
    now: WED,
  });
  assert.deepEqual(rows.find((r) => r.areaId === 'a1'), {
    areaId: 'a1', label: 'Health', showingUp: 1, participating: 2,
  });
});

test('members without a goal are excluded from the denominator', () => {
  // Three circle members, only one has a Learning goal. It must read 1 of 1,
  // not 1 of 3 - opting out is never rendered as failing.
  const rows = areaRollup({
    areas,
    goals: [
      { id: 'g3', user_id: 'u1', area_id: 'a2', target_type: 'daily', target_count: null, target_weekdays: null },
    ],
    checkinsByGoal: { g3: ['2026-08-05'] },
    now: WED,
  });
  assert.deepEqual(rows.find((r) => r.areaId === 'a2'), {
    areaId: 'a2', label: 'Learning', showingUp: 1, participating: 1,
  });
});

test('an area nobody has a goal in reports zero of zero', () => {
  const rows = areaRollup({ areas, goals: [], checkinsByGoal: {}, now: WED });
  assert.deepEqual(rows, [
    { areaId: 'a1', label: 'Health', showingUp: 0, participating: 0 },
    { areaId: 'a2', label: 'Learning', showingUp: 0, participating: 0 },
  ]);
});

test('circle activity streak counts consecutive days with any check-in', () => {
  assert.equal(circleActivityStreak(['2026-08-05', '2026-08-04', '2026-08-03'], WED), 3);
  // One member checking in is enough to keep it alive - it measures
  // aliveness, not health, and cannot shame anyone.
  assert.equal(circleActivityStreak(['2026-08-04', '2026-08-04', '2026-08-03'], WED), 2);
});

test('circle activity streak survives a today with no check-in yet', () => {
  assert.equal(circleActivityStreak(['2026-08-04', '2026-08-03'], WED), 2);
  assert.equal(circleActivityStreak([], WED), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './circleRollup.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/circleRollup.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/circleRollup.ts src/lib/circleRollup.test.ts
git commit -m "Roll up Areas by members showing up, and count circle activity days"
```

---

## Verification

After all eleven tasks:

```bash
npm test                                    # all unit + fixture tests pass
npx tsc --noEmit                            # clean
npx eslint src/lib/periods.ts src/lib/showingUp.ts src/lib/circleRollup.ts
npx supabase db reset                        # 0046-0048 apply in order
node scripts/check-showing-up-parity.mjs    # TS and SQL agree
```

## What this plan deliberately does not do

- **No UI.** No screens, hooks or components change. `GoalsScreen`'s numeric target field, the Circle tab rollup, Area detail and Manage Areas are Plan 2.
- **No consumer rewrites.** `useGarden`, `needsAttention`, `weeklyHighlight`, `CircleAICard`, `sync_step_goal`, the two edge functions and the taxonomy migration (`suggestions.ts`, `profiles.interests`, `PillarIcons`) are Plan 3. Until then they keep reading `streak_count` and `last_logged_date`, which still exist and still work.
- **No writes to the new tables from the app.** Nothing checks in yet. The ledger is built and tested; Plan 2 fills it.

This ordering is deliberate: the schema and the rule are what every later phase depends on, and they are the only parts that can be fully verified without a device.
