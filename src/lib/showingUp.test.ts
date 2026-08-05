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
