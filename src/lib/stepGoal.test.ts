import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStepGoal } from './stepGoal.ts';

test('the built-in walking suggestion is a step goal', () => {
  assert.equal(isStepGoal('Walk 8,000 steps daily', 8000), true);
});

test('a typed steps goal is a step goal', () => {
  assert.equal(isStepGoal('10000 steps every day', 10000), true);
  assert.equal(isStepGoal('Hit my step count', 6000), true);
});

test('matching is case-insensitive', () => {
  assert.equal(isStepGoal('WALK 8000 STEPS', 8000), true);
  assert.equal(isStepGoal('Steps', 5000), true);
});

test('a target under 1000 is never a step goal, whatever the title says', () => {
  // The guard that stops a business plan being logged from a pedometer.
  assert.equal(isStepGoal('Steps to launch my business', 5), false);
  assert.equal(isStepGoal('Next steps for the house move', 10), false);
  assert.equal(isStepGoal('Walk 999 steps', 999), false);
});

test('exactly 1000 is a step goal - the boundary is inclusive', () => {
  assert.equal(isStepGoal('Walk 1000 steps', 1000), true);
});

test('a large target does not make a non-steps goal a step goal', () => {
  assert.equal(isStepGoal('Read 5000 pages', 5000), false);
  assert.equal(isStepGoal('Save 20000 rupees', 20000), false);
});

test('stepping and stepped are not step counts', () => {
  // Substring matching on "step" would catch these; word matching does not.
  assert.equal(isStepGoal('Stepping up my running', 5000), false);
  assert.equal(isStepGoal('Have stepped back from work', 2000), false);
});

test('an empty or nonsense title is not a step goal', () => {
  assert.equal(isStepGoal('', 8000), false);
  assert.equal(isStepGoal('   ', 8000), false);
});
