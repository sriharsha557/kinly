import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNudgeMessage, type NudgeMessage } from './nudgeMessages.ts';

function msg(
  id: string,
  kind: string,
  body: string,
  placeholders: string[] = [],
  weight = 1,
): NudgeMessage {
  return { id, kind, body, placeholders, weight };
}

test('picks a message of the requested kind', () => {
  const messages = [msg('a', 'cheer', 'Nice work!'), msg('b', 'water', 'Drink up!')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, [], 0), { id: 'a', body: 'Nice work!' });
});

test('returns null when no message of that kind exists', () => {
  assert.equal(pickNudgeMessage([msg('a', 'cheer', 'Nice work!')], 'walk', {}, [], 0), null);
});

test('substitutes every placeholder it uses', () => {
  const messages = [msg('a', 'cheer', 'Proud of you, {name}!', ['name'])];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', { name: 'Priya' }, [], 0), {
    id: 'a',
    body: 'Proud of you, Priya!',
  });
});

test('substitutes several placeholders in one message', () => {
  const messages = [msg('a', 'keep_going', '{name}, keep going on {goal}!', ['name', 'goal'])];
  assert.deepEqual(
    pickNudgeMessage(messages, 'keep_going', { name: 'Sara', goal: 'Run 5km' }, [], 0),
    { id: 'a', body: 'Sara, keep going on Run 5km!' },
  );
});

test('a message is ineligible when its placeholder has no value', () => {
  // The structural guarantee: "Keep going on undefined!" can never render.
  const messages = [
    msg('needs-goal', 'keep_going', 'Keep going on {goal}!', ['goal']),
    msg('generic', 'keep_going', "You've got this."),
  ];
  assert.deepEqual(pickNudgeMessage(messages, 'keep_going', {}, [], 0), {
    id: 'generic',
    body: "You've got this.",
  });
});

test('an empty string does not satisfy a placeholder', () => {
  const messages = [
    msg('needs-name', 'cheer', 'Go on, {name}!', ['name']),
    msg('generic', 'cheer', 'Go on!'),
  ];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', { name: '' }, [], 0), {
    id: 'generic',
    body: 'Go on!',
  });
});

test('a streak of zero still satisfies the streak placeholder', () => {
  // 0 is falsy but is a real value - a naive truthiness check would drop it.
  const messages = [msg('a', 'streak', '{streak} days!', ['streak'])];
  assert.deepEqual(pickNudgeMessage(messages, 'streak', { streak: 0 }, [], 0), {
    id: 'a',
    body: '0 days!',
  });
});

test('skips messages shown recently', () => {
  const messages = [msg('a', 'cheer', 'First'), msg('b', 'cheer', 'Second')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, ['a'], 0), { id: 'b', body: 'Second' });
});

test('ignores the recent list rather than returning nothing', () => {
  // A repeat beats no message at all.
  const messages = [msg('a', 'cheer', 'Only one')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, ['a'], 0), { id: 'a', body: 'Only one' });
});

test('weight biases selection proportionally', () => {
  // Total weight 4: 'heavy' owns [0, 0.75), 'light' owns [0.75, 1).
  const messages = [msg('heavy', 'cheer', 'Heavy', [], 3), msg('light', 'cheer', 'Light', [], 1)];
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0)?.id, 'heavy');
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.7)?.id, 'heavy');
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.8)?.id, 'light');
});

test('random at the very top of the range still returns a message', () => {
  // Guards the off-by-one where random === 1 falls past the last bucket.
  const messages = [msg('a', 'cheer', 'A', [], 1), msg('b', 'cheer', 'B', [], 1)];
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.999999)?.id, 'b');
  assert.notEqual(pickNudgeMessage(messages, 'cheer', {}, [], 1), null);
});

test('an empty library returns null', () => {
  assert.equal(pickNudgeMessage([], 'cheer', {}, [], 0), null);
});
