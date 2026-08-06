import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCadence, validateCadence, WEEKDAY_LABELS } from './cadence.ts';

test('weekday labels are Monday-first, matching WEEK_STARTS_ON', () => {
  assert.deepEqual(WEEKDAY_LABELS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('describeCadence renders each cadence in its own words', () => {
  assert.equal(
    describeCadence({ target_type: 'daily', target_count: null, target_weekdays: null }),
    'Every day',
  );
  assert.equal(
    describeCadence({ target_type: 'times_per_week', target_count: 4, target_weekdays: null }),
    '4× a week',
  );
  assert.equal(
    describeCadence({ target_type: 'times_per_week', target_count: 1, target_weekdays: null }),
    'Once a week',
  );
  assert.equal(
    describeCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [1, 3, 5] }),
    'Mon · Wed · Fri',
  );
  assert.equal(
    describeCadence({ target_type: 'monthly', target_count: 1, target_weekdays: null }),
    'Once a month',
  );
  assert.equal(
    describeCadence({ target_type: 'monthly', target_count: 3, target_weekdays: null }),
    '3× a month',
  );
});

test('describeCadence renders weekdays in Monday-first order regardless of input order', () => {
  assert.equal(
    describeCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [5, 1, 3] }),
    'Mon · Wed · Fri',
  );
});

test('describeCadence never returns an empty string for a goal with no cadence', () => {
  // Every goal the current app created before this plan has target_type null.
  assert.equal(
    describeCadence({ target_type: null, target_count: null, target_weekdays: null }),
    'No cadence set',
  );
});

test('validateCadence accepts well-formed drafts', () => {
  assert.equal(validateCadence({ target_type: 'daily', target_count: null, target_weekdays: null }), null);
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 4, target_weekdays: null }),
    null,
  );
  assert.equal(
    validateCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [1] }),
    null,
  );
  assert.equal(validateCadence({ target_type: 'monthly', target_count: 1, target_weekdays: null }), null);
});

test('validateCadence rejects a count the database would refuse', () => {
  // goals_target_count_positive: check (target_count is null or target_count > 0)
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 0, target_weekdays: null }),
    'Pick how many times a week.',
  );
  assert.equal(
    validateCadence({ target_type: 'monthly', target_count: 0, target_weekdays: null }),
    'Pick how many times a month.',
  );
});

test('validateCadence rejects more than seven times a week', () => {
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 8, target_weekdays: null }),
    'A week only has seven days.',
  );
});

test('validateCadence rejects an empty weekday set', () => {
  assert.equal(
    validateCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [] }),
    'Pick at least one day.',
  );
});

test('validateCadence rejects a missing cadence', () => {
  assert.equal(
    validateCadence({ target_type: null, target_count: null, target_weekdays: null }),
    'Pick how often.',
  );
});
