import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberActivity, EMPTY_ACTIVITY, type ActivityGoal } from './memberActivity.ts';

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
