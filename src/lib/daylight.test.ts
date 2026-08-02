import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daylightPhase } from './daylight.ts';

// Local time, since daylightPhase reads getHours() - the phase should follow
// the clock the user is actually looking at, not UTC.
function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 7, 2);
  d.setHours(hour, minute, 0, 0);
  return d;
}

test('each clock band maps to its phase', () => {
  assert.equal(daylightPhase(at(6)), 'dawn');
  assert.equal(daylightPhase(at(12)), 'day');
  assert.equal(daylightPhase(at(18, 30)), 'dusk');
  assert.equal(daylightPhase(at(22)), 'night');
});

test('boundaries belong to the band they open', () => {
  assert.equal(daylightPhase(at(5)), 'dawn');
  assert.equal(daylightPhase(at(8)), 'day');
  assert.equal(daylightPhase(at(17)), 'dusk');
  assert.equal(daylightPhase(at(20)), 'night');
});

test('the small hours are night, not dawn', () => {
  assert.equal(daylightPhase(at(0)), 'night');
  assert.equal(daylightPhase(at(3, 59)), 'night');
  assert.equal(daylightPhase(at(4, 59)), 'night');
});

test('every hour of the day resolves to some phase', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const phase = daylightPhase(at(hour));
    assert.ok(['dawn', 'day', 'dusk', 'night'].includes(phase), `hour ${hour} gave ${phase}`);
  }
});

test('solar times shift the bands off the fixed clock', () => {
  // A late-summer far-northern day: 04:30 sunrise, 22:00 sunset. 21:00 is
  // 'night' on the fixed clock but should still be daylight here.
  const solar = { sunrise: 4.5, sunset: 22 };
  assert.equal(daylightPhase(at(21), solar), 'dusk');
  assert.equal(daylightPhase(at(12), solar), 'day');
  assert.equal(daylightPhase(at(4, 30), solar), 'dawn');
  assert.equal(daylightPhase(at(2), solar), 'night');
});

test('solar twilight straddles the event rather than following it', () => {
  const solar = { sunrise: 7, sunset: 19 };
  assert.equal(daylightPhase(at(6), solar), 'dawn');
  assert.equal(daylightPhase(at(8), solar), 'dawn');
  assert.equal(daylightPhase(at(5, 15), solar), 'night');
  assert.equal(daylightPhase(at(9), solar), 'day');
});
