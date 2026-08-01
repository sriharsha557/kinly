import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsAttention, isInGraceWindow } from './needsAttention.ts';

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

function goal(user_id: string, last_logged_date: string | null, streak_count = 1, id = `g-${user_id}`) {
  return { id, user_id, last_logged_date, streak_count };
}

test('the grace window is exactly two days since the last log', () => {
  assert.equal(isInGraceWindow(daysAgo(1), NOW), false);
  assert.equal(isInGraceWindow(daysAgo(2), NOW), true);
  assert.equal(isInGraceWindow(daysAgo(3), NOW), false);
  assert.equal(isInGraceWindow(null, NOW), false);
});

test('a streak inside the grace window is at risk, and carries its goal id', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 12, 'goal-1')],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [
    { userId: SARA, name: 'Sara', reason: 'streak_at_risk', detail: '12-day streak ends today', goalId: 'goal-1' },
  ]);
});

test('with several at-risk goals the longest streak wins - most to lose', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 3, 'goal-short'), goal(SARA, daysAgo(2), 20, 'goal-long')],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].goalId, 'goal-long');
  assert.equal(rows[0].detail, '20-day streak ends today');
});

test('a tough-day check-in surfaces', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(0))],
    toughToday: [SARA],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [{ userId: SARA, name: 'Sara', reason: 'tough_day', detail: 'had a tough day' }]);
});

test('quiet starts after more than three days, matching the wilt threshold', () => {
  const threeDays = needsAttention({
    members,
    goals: [goal(RAVI, daysAgo(3))],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(threeDays, []);

  const fourDays = needsAttention({
    members,
    goals: [goal(RAVI, daysAgo(4))],
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
    goals: [goal(RAVI, null)],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('a member with no goals at all is not quiet', () => {
  const rows = needsAttention({ members, goals: [], toughToday: [], viewerId: ME, now: NOW });
  assert.deepEqual(rows, []);
});

test('the viewer never appears, however bad their own week', () => {
  const rows = needsAttention({
    members,
    goals: [goal(ME, daysAgo(2), 9), goal(ME, daysAgo(30))],
    toughToday: [ME],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('one row per member, under the most urgent reason', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 12)],
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
    goals: [goal(RAVI, daysAgo(9)), goal(SARA, daysAgo(2), 12)],
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
    goals: [],
    toughToday: ['user-ghost'],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('an empty circle produces no rows', () => {
  assert.deepEqual(needsAttention({ members: [], goals: [], toughToday: [], viewerId: ME, now: NOW }), []);
});
