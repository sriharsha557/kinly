import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circlePrompt, type CircleCategory } from './circlePrompts.ts';

const ALL: CircleCategory[] = ['health', 'wealth', 'ideas', 'learning', 'relationships'];

test('the same seed always gives the same result', () => {
  const a = circlePrompt('health', 'wealth', 7);
  const b = circlePrompt('health', 'wealth', 7);
  assert.deepEqual(a, b);
});

test('the challenge is stable across a week but varies across weeks', () => {
  const seen = new Set<string>();
  for (let weekSeed = 0; weekSeed < 12; weekSeed++) {
    seen.add(circlePrompt('health', 'wealth', weekSeed).suggestedChallenge);
  }
  // Not one fixed string forever - the point of seeding is rotation.
  assert.ok(seen.size > 1, 'expected the suggestion to vary across weeks');
});

test('the challenge targets the weakest category, not the strongest', () => {
  const health = circlePrompt('wealth', 'health', 3).suggestedChallenge;
  const wealth = circlePrompt('health', 'wealth', 3).suggestedChallenge;
  assert.notEqual(health, wealth);
});

test('with no weakest category it falls back to the strongest', () => {
  const prompt = circlePrompt('learning', null, 3);
  assert.ok(prompt.suggestedChallenge.length > 0);
  assert.ok(prompt.message.length > 0);
});

test('every category pairing produces non-empty copy', () => {
  for (const strongest of ALL) {
    for (const weakest of [...ALL, null]) {
      for (const seed of [0, 1, 5, 41]) {
        const prompt = circlePrompt(strongest, weakest, seed);
        assert.ok(prompt.message.length > 0, `${strongest}/${weakest}`);
        assert.ok(prompt.suggestedChallenge.length > 0, `${strongest}/${weakest}`);
        assert.ok(!prompt.message.includes('undefined'), `${strongest}/${weakest}`);
        assert.ok(!prompt.suggestedChallenge.includes('undefined'), `${strongest}/${weakest}`);
      }
    }
  }
});

test('the message names the strongest category', () => {
  assert.match(circlePrompt('relationships', 'wealth', 1).message, /each other|relationship/i);
});

test('a negative or huge seed still picks a real message', () => {
  // weekSeed comes from date arithmetic; it must never index out of bounds.
  for (const seed of [-5, -1, 0, 999999]) {
    const prompt = circlePrompt('health', 'ideas', seed);
    assert.ok(prompt.suggestedChallenge.length > 0, String(seed));
  }
});
