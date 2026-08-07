import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeDigest, type DigestEvent } from './digest.ts';

function ev(type: string, actor_name: string, payload: Record<string, unknown> = {}, user_id = actor_name): DigestEvent {
  return { type, actor_name, payload, user_id };
}

test('an empty day produces no digest at all', () => {
  assert.equal(composeDigest([], 5), null);
});

test('a day of only immediate-tier events produces no digest', () => {
  assert.equal(composeDigest([ev('ask', 'Priya', { question: 'help?' })], 5), null);
});

test('streak milestones outrank goal completions', () => {
  const lines = composeDigest(
    [
      ev('goal_completed', 'Priya', { title: 'Run 5km' }),
      ev('streak', 'Rahul', { streak_count: 10 }),
    ],
    5,
  );
  assert.deepEqual(lines, ['Rahul reached a 10-streak', 'Priya completed "Run 5km"']);
});

test('everyone checking in aggregates into one celebratory line', () => {
  const lines = composeDigest(
    [ev('mood_checkin', 'A'), ev('mood_checkin', 'B'), ev('mood_checkin', 'C')],
    3,
  );
  assert.deepEqual(lines, ['Everyone checked in today 🎉']);
});

test('a partial turnout counts friends instead', () => {
  const lines = composeDigest([ev('mood_checkin', 'A'), ev('mood_checkin', 'B')], 5);
  assert.deepEqual(lines, ['2 friends checked in']);
});

test('one person checking in reads in the singular', () => {
  const lines = composeDigest([ev('mood_checkin', 'A')], 5);
  assert.deepEqual(lines, ['1 friend checked in']);
});

test('the same person checking in twice counts once', () => {
  const lines = composeDigest([ev('mood_checkin', 'A', {}, 'a'), ev('mood_checkin', 'B', {}, 'a')], 5);
  assert.deepEqual(lines, ['1 friend checked in']);
});

test('a busy day caps at three lines plus a tail', () => {
  const lines = composeDigest(
    [
      ev('streak', 'A', { streak_count: 3 }),
      ev('streak', 'B', { streak_count: 7 }),
      ev('goal_completed', 'C', { title: 'Read' }),
      ev('goal_completed', 'D', { title: 'Swim' }),
      ev('garden_grew', 'E', { stage: 'tree' }),
    ],
    5,
  );
  assert.deepEqual(lines, [
    'A reached a 3-streak',
    'B reached a 7-streak',
    'C completed "Read"',
    'and 2 more',
  ]);
});

test('garden growth reads in the stage the member reached', () => {
  const lines = composeDigest([ev('garden_grew', 'Meera', { stage: 'bloom' })], 5);
  assert.deepEqual(lines, ["Meera's garden is blooming"]);
});

test('a streak event with no streak_count produces no digest at all', () => {
  assert.equal(composeDigest([ev('streak', 'A', {})], 5), null);
});

test('a streak event with streak_count 1 still renders normally', () => {
  const lines = composeDigest([ev('streak', 'A', { streak_count: 1 })], 5);
  assert.deepEqual(lines, ['A reached a 1-streak']);
});

test('a goal check-in with no mood check-in still counts as participation', () => {
  const lines = composeDigest([], 5, ['a', 'b']);
  assert.deepEqual(lines, ['2 friends checked in']);
});

test('a goal check-in alone is not an empty day', () => {
  assert.notEqual(composeDigest([], 5, ['a']), null);
});

test('a member who both mood-checked-in and goal-checked-in counts once', () => {
  const lines = composeDigest([ev('mood_checkin', 'A', {}, 'a')], 5, ['a']);
  assert.deepEqual(lines, ['1 friend checked in']);
});

test('mood check-ins and goal check-ins union into one participation count', () => {
  const lines = composeDigest([ev('mood_checkin', 'A', {}, 'a')], 5, ['b']);
  assert.deepEqual(lines, ['2 friends checked in']);
});

test('everyone checking in via goal check-ins alone reads the same as mood check-ins', () => {
  const lines = composeDigest([], 3, ['a', 'b', 'c']);
  assert.deepEqual(lines, ['Everyone checked in today 🎉']);
});
