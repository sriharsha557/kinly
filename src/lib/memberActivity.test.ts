import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  memberActivity,
  longestStreakGoalByMember,
  EMPTY_ACTIVITY,
  type ActivityGoal,
} from './memberActivity.ts';

// Wednesday 2026-08-05, midday.
const WED = new Date(2026, 7, 5, 12).getTime();

const daily = (id: string, user_id: string): ActivityGoal => ({
  id,
  user_id,
  target_type: 'daily',
  target_count: null,
  target_weekdays: null,
});

test('a member with no goals is absent from the map', () => {
  const map = memberActivity([], {}, WED);
  assert.equal(map.size, 0);
  assert.deepEqual(map.get('u1'), undefined);
});

test('EMPTY_ACTIVITY is the neutral value for a member with no goals', () => {
  // Callers render this rather than branching on undefined - a member who
  // set no goal is at rest, not behind.
  assert.equal(EMPTY_ACTIVITY.bestStreak, 0);
  assert.equal(EMPTY_ACTIVITY.lastCheckinDate, null);
  assert.equal(EMPTY_ACTIVITY.showingUp, 0);
  assert.equal(EMPTY_ACTIVITY.goalCount, 0);
});

test('best streak is the longest across a member s goals', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u1')];
  const checkins = {
    g1: ['2026-08-05', '2026-08-04'],
    g2: ['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02'],
  };
  const activity = memberActivity(goals, checkins, WED).get('u1');
  assert.equal(activity?.bestStreak, 4);
});

test('last check-in is the most recent across a member s goals', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u1')];
  const checkins = { g1: ['2026-08-01'], g2: ['2026-08-04'] };
  const activity = memberActivity(goals, checkins, WED).get('u1');
  assert.equal(activity?.lastCheckinDate, '2026-08-04');
});

test('showingUp counts goals the member is honouring, not check-ins', () => {
  const fourPerWeek: ActivityGoal = {
    id: 'g3',
    user_id: 'u1',
    target_type: 'times_per_week',
    target_count: 4,
    target_weekdays: null,
  };
  // g1 daily, not done today -> not showing up.
  // g3 4x/week, nothing logged, Wednesday -> still reachable, showing up.
  const activity = memberActivity([daily('g1', 'u1'), fourPerWeek], { g1: [], g3: [] }, WED).get('u1');
  assert.equal(activity?.showingUp, 1);
  assert.equal(activity?.goalCount, 2);
});

test('members are kept separate', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u2')];
  const checkins = { g1: ['2026-08-05'], g2: [] };
  const map = memberActivity(goals, checkins, WED);
  assert.equal(map.get('u1')?.bestStreak, 1);
  assert.equal(map.get('u2')?.bestStreak, 0);
  assert.equal(map.get('u2')?.lastCheckinDate, null);
});

test('a goal with no check-ins contributes nothing but still counts', () => {
  const activity = memberActivity([daily('g1', 'u1')], {}, WED).get('u1');
  assert.equal(activity?.bestStreak, 0);
  assert.equal(activity?.lastCheckinDate, null);
  assert.equal(activity?.goalCount, 1);
});

// Restored from needsAttention.test.ts, where this rule was tested until the
// attention list stopped picking the goal itself. Deleting it there without
// re-homing it left the rule live in a component with no tests.
test('with several at-risk goals the longest streak wins - most to lose', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u1')];
  const checkins = {
    g1: ['2026-08-05', '2026-08-04'],
    g2: ['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02'],
  };
  assert.equal(longestStreakGoalByMember(goals, checkins, WED).u1, 'g2');
});

test('longestStreakGoalByMember keeps members apart', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u2')];
  const checkins = { g1: ['2026-08-05'], g2: ['2026-08-05', '2026-08-04'] };
  const byMember = longestStreakGoalByMember(goals, checkins, WED);
  assert.equal(byMember.u1, 'g1');
  assert.equal(byMember.u2, 'g2');
});

test('a member whose goals all have zero streak still gets one to water', () => {
  // Nothing logged anywhere: there is still a goal to offer, because the
  // grace window - not the streak length - is what decides whether the row
  // appears at all.
  const byMember = longestStreakGoalByMember([daily('g1', 'u1')], {}, WED);
  assert.equal(byMember.u1, 'g1');
});
