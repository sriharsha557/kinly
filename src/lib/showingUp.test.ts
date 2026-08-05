import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isShowingUp, type Cadence } from './showingUp.ts';

// Wednesday 2026-08-05, midday, so nothing depends on the hour.
const WED = new Date(2026, 7, 5, 12).getTime();

const daily: Cadence = { target_type: 'daily', target_count: null, target_weekdays: null };

test('daily is showing up only when today has a check-in', () => {
  assert.equal(isShowingUp(daily, ['2026-08-05'], WED), true);
  assert.equal(isShowingUp(daily, ['2026-08-04'], WED), false);
  assert.equal(isShowingUp(daily, [], WED), false);
});

test('daily ignores future and duplicate check-ins', () => {
  assert.equal(isShowingUp(daily, ['2026-08-06'], WED), false);
  assert.equal(isShowingUp(daily, ['2026-08-05', '2026-08-05'], WED), true);
});
