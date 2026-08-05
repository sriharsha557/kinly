import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isShowingUp, streak, consistency, type Cadence } from './showingUp.ts';

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

test('specific_weekdays streak is 0 when target_weekdays is null', () => {
  const nullWeekdays: Cadence = { target_type: 'specific_weekdays', target_count: null, target_weekdays: null };
  assert.equal(streak(nullWeekdays, [], WED), 0);
});

test('specific_weekdays streak is 0 when target_weekdays is empty', () => {
  const emptyWeekdays: Cadence = { target_type: 'specific_weekdays', target_count: null, target_weekdays: [] };
  assert.equal(streak(emptyWeekdays, [], WED), 0);
});

test('times_per_week streak is 0 when target_count is 0', () => {
  const zeroPerWeek: Cadence = { target_type: 'times_per_week', target_count: 0, target_weekdays: null };
  assert.equal(streak(zeroPerWeek, [], WED), 0);
});

test('monthly streak is 0 when target_count is 0', () => {
  const zeroMonthly: Cadence = { target_type: 'monthly', target_count: 0, target_weekdays: null };
  assert.equal(streak(zeroMonthly, [], WED), 0);
});

test('times_per_week streak is 0 when target_count is negative', () => {
  const negativePerWeek: Cadence = { target_type: 'times_per_week', target_count: -1, target_weekdays: null };
  assert.equal(streak(negativePerWeek, [], WED), 0);
});

test('monthly streak is 0 when target_count is negative', () => {
  const negativeMonthly: Cadence = { target_type: 'monthly', target_count: -1, target_weekdays: null };
  assert.equal(streak(negativeMonthly, [], WED), 0);
});

test('streak returns 0 for an unrecognised target_type', () => {
  const bogus = { target_type: 'bogus', target_count: null, target_weekdays: null } as unknown as Cadence;
  assert.equal(streak(bogus, [], WED), 0);
});

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
