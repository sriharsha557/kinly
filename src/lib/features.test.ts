import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, type FeatureFlag } from './features.ts';

// Guards against a typo'd or dropped key: every gate in the app reads one of
// these names, and a missing one silently evaluates to undefined - which is
// falsy, so the feature would vanish with no error anywhere.
const EXPECTED: FeatureFlag[] = [
  'guessWho',
  'circleCard',
  'wouldYouRather',
  'visionBoard',
  'meetups',
  'circleAI',
  'weeklyRecap',
  'lifeTimeline',
];

test('every declared flag is present and boolean', () => {
  for (const flag of EXPECTED) {
    assert.equal(typeof FEATURES[flag], 'boolean', `${flag} must be a boolean`);
  }
});

test('no undeclared flags have crept in', () => {
  assert.deepEqual(Object.keys(FEATURES).sort(), [...EXPECTED].sort());
});
