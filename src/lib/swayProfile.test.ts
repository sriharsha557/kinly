import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SWAY_RANGES, swayProfile } from './swayProfile.ts';

const IDS = [
  '2f1b9c3e-1a4d-4c8e-9f0a-7b6c5d4e3f21',
  '2f1b9c3e-1a4d-4c8e-9f0a-7b6c5d4e3f22',
  '9c8b7a65-4321-4def-8abc-1234567890ab',
  'e0000000-0000-4000-8000-000000000000',
  'a',
  '',
];

test('the same id always produces the same profile', () => {
  for (const id of IDS) {
    assert.deepEqual(swayProfile(id), swayProfile(id));
  }
});

test('every output sits inside its declared range', () => {
  for (const id of IDS) {
    const { amplitude, period, delay } = swayProfile(id);
    assert.ok(amplitude >= SWAY_RANGES.amplitude[0] && amplitude <= SWAY_RANGES.amplitude[1], `amplitude ${amplitude}`);
    assert.ok(period >= SWAY_RANGES.period[0] && period <= SWAY_RANGES.period[1], `period ${period}`);
    assert.ok(delay >= SWAY_RANGES.delay[0] && delay <= SWAY_RANGES.delay[1], `delay ${delay}`);
  }
});

// The point of the module. Circle members have UUIDs that often differ in a
// single character, and a hash without avalanche maps those to neighbouring
// rhythms - leaving the row in the near-lockstep this replaced.
//
// Asserted in aggregate rather than per pair: two independent values land
// close together by chance often enough that any single pair is a coin flip.
// Without the hash finalizer this average sits near 0.06; with it, near the
// 0.33 a uniform spread gives.
test('ids differing by one character spread across the rhythm range', () => {
  const span = SWAY_RANGES.period[1] - SWAY_RANGES.period[0];
  let total = 0;
  const pairs = 500;
  for (let i = 0; i < pairs; i += 1) {
    const stem = '2f1b9c3e-1a4d-4c8e-9f0a-7b6c5d4e';
    const a = swayProfile(stem + String(i).padStart(4, '0'));
    const b = swayProfile(stem + String(i + 1).padStart(4, '0'));
    total += Math.abs(a.period - b.period) / span;
  }
  const mean = total / pairs;
  assert.ok(mean > 0.25, `adjacent ids cluster: mean period delta ${mean.toFixed(3)} of range`);
});

test('the three values are not locked to each other', () => {
  // If all three came from one slice of the hash, the plant with the widest
  // sway would always be the slowest and the latest. Ranking ids by each
  // value should give different orders.
  const byAmplitude = [...IDS].sort((x, y) => swayProfile(x).amplitude - swayProfile(y).amplitude);
  const byPeriod = [...IDS].sort((x, y) => swayProfile(x).period - swayProfile(y).period);
  assert.notDeepEqual(byAmplitude, byPeriod);
});
