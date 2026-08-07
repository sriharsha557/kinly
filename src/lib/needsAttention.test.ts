import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsAttention, isInGraceWindow, calendarDaysSince } from './needsAttention.ts';
import type { MemberActivity } from './memberActivity.ts';

// A fixed "now" so expectations never drift with the day the suite runs.
const NOW = Date.parse('2026-08-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

const ME = 'user-me';
const SARA = 'user-sara';
const RAVI = 'user-ravi';

const members = [
  { userId: ME, name: 'Me' },
  { userId: SARA, name: 'Sara' },
  { userId: RAVI, name: 'Ravi' },
];

// A member's row from the ledger-derived summary, with everything but the
// fields each test cares about defaulted to something neutral.
function memberActivity(overrides: Partial<MemberActivity>): MemberActivity {
  return { bestStreak: 0, lastCheckinDate: null, showingUp: 0, goalCount: 1, ...overrides };
}

test('the grace window is exactly two days since the last log', () => {
  assert.equal(isInGraceWindow(daysAgo(1), NOW), false);
  assert.equal(isInGraceWindow(daysAgo(2), NOW), true);
  assert.equal(isInGraceWindow(daysAgo(3), NOW), false);
  assert.equal(isInGraceWindow(null, NOW), false);
});

test('a streak inside the grace window is at risk, and carries its goal id', () => {
  const activity = new Map([[SARA, memberActivity({ bestStreak: 12, lastCheckinDate: daysAgo(2) })]]);
  const atRiskGoalByMember = { [SARA]: 'goal-1' };
  const rows = needsAttention({
    members,
    activity,
    atRiskGoalByMember,
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [
    { userId: SARA, name: 'Sara', reason: 'streak_at_risk', detail: 'streak ends today', goalId: 'goal-1' },
  ]);
});

test('a tough-day check-in surfaces', () => {
  const activity = new Map([[SARA, memberActivity({ bestStreak: 1, lastCheckinDate: daysAgo(0) })]]);
  const rows = needsAttention({
    members,
    activity,
    atRiskGoalByMember: {},
    toughToday: [SARA],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [{ userId: SARA, name: 'Sara', reason: 'tough_day', detail: 'had a tough day' }]);
});

test('quiet starts after more than three days, matching the wilt threshold', () => {
  const threeDays = needsAttention({
    members,
    activity: new Map([[RAVI, memberActivity({ lastCheckinDate: daysAgo(3) })]]),
    atRiskGoalByMember: {},
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(threeDays, []);

  const fourDays = needsAttention({
    members,
    activity: new Map([[RAVI, memberActivity({ lastCheckinDate: daysAgo(4) })]]),
    atRiskGoalByMember: {},
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(fourDays, [
    { userId: RAVI, name: 'Ravi', reason: 'quiet', detail: 'quiet for 4 days' },
  ]);
});

test('a member who has never logged anything is not quiet', () => {
  const rows = needsAttention({
    members,
    activity: new Map([[RAVI, memberActivity({ lastCheckinDate: null })]]),
    atRiskGoalByMember: {},
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('a member with no goals at all is not quiet', () => {
  const rows = needsAttention({
    members,
    activity: new Map(),
    atRiskGoalByMember: {},
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('the viewer never appears, however bad their own week', () => {
  const rows = needsAttention({
    members,
    activity: new Map([[ME, memberActivity({ bestStreak: 9, lastCheckinDate: daysAgo(2) })]]),
    atRiskGoalByMember: { [ME]: 'g-me' },
    toughToday: [ME],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('one row per member, under the most urgent reason', () => {
  const rows = needsAttention({
    members,
    activity: new Map([[SARA, memberActivity({ bestStreak: 12, lastCheckinDate: daysAgo(2) })]]),
    atRiskGoalByMember: { [SARA]: 'g-sara' },
    toughToday: [SARA],
    viewerId: ME,
    now: NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'streak_at_risk');
});

test('rows rank at-risk, then tough day, then quiet', () => {
  const rows = needsAttention({
    members,
    activity: new Map([
      [RAVI, memberActivity({ lastCheckinDate: daysAgo(9) })],
      [SARA, memberActivity({ bestStreak: 12, lastCheckinDate: daysAgo(2) })],
    ]),
    atRiskGoalByMember: { [SARA]: 'g-sara' },
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(
    rows.map((r) => r.reason),
    ['streak_at_risk', 'quiet'],
  );
});

test('a member in toughToday who is not in members is ignored', () => {
  const rows = needsAttention({
    members,
    activity: new Map(),
    atRiskGoalByMember: {},
    toughToday: ['user-ghost'],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('an empty circle produces no rows', () => {
  assert.deepEqual(
    needsAttention({ members: [], activity: new Map(), atRiskGoalByMember: {}, toughToday: [], viewerId: ME, now: NOW }),
    [],
  );
});

// The old formula divided a UTC-parsed midnight by 86400000 against a local
// instant, so the answer moved with the viewer's clock: the "water this
// streak" row appeared and vanished depending on the hour. These pin the
// count to calendar days, whatever time of day it is asked.
test('the day count is the same at every hour of the day', () => {
  const date = '2026-07-30';
  const atEachHour = Array.from({ length: 24 }, (_, hour) =>
    calendarDaysSince(date, new Date(2026, 7, 1, hour, 30).getTime()),
  );
  assert.deepEqual(new Set(atEachHour), new Set([2]));
});

test('the grace window holds at every hour of the day', () => {
  const date = '2026-07-30';
  for (let hour = 0; hour < 24; hour++) {
    assert.equal(isInGraceWindow(date, new Date(2026, 7, 1, hour, 30).getTime()), true, `hour ${hour}`);
  }
});

test('same calendar day is zero days, tomorrow is one', () => {
  assert.equal(calendarDaysSince('2026-08-01', new Date(2026, 7, 1, 23, 59).getTime()), 0);
  assert.equal(calendarDaysSince('2026-07-31', new Date(2026, 7, 1, 0, 1).getTime()), 1);
});
