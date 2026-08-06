import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaRollup, circleActivityStreak } from './circleRollup.ts';

const WED = new Date(2026, 7, 5, 12).getTime();

const areas = [{ id: 'a1', label: 'Health' }, { id: 'a2', label: 'Learning' }];

test('rollup counts members showing up over members with a goal', () => {
  const rows = areaRollup({
    areas,
    goals: [
      { id: 'g1', user_id: 'u1', area_id: 'a1', target_type: 'daily', target_count: null, target_weekdays: null },
      { id: 'g2', user_id: 'u2', area_id: 'a1', target_type: 'daily', target_count: null, target_weekdays: null },
    ],
    checkinsByGoal: { g1: ['2026-08-05'], g2: [] },
    now: WED,
  });
  assert.deepEqual(rows.find((r) => r.areaId === 'a1'), {
    areaId: 'a1', label: 'Health', showingUp: 1, participating: 2,
  });
});

test('members without a goal are excluded from the denominator', () => {
  // Three circle members, only one has a Learning goal. It must read 1 of 1,
  // not 1 of 3 - opting out is never rendered as failing.
  const rows = areaRollup({
    areas,
    goals: [
      { id: 'g3', user_id: 'u1', area_id: 'a2', target_type: 'daily', target_count: null, target_weekdays: null },
    ],
    checkinsByGoal: { g3: ['2026-08-05'] },
    now: WED,
  });
  assert.deepEqual(rows.find((r) => r.areaId === 'a2'), {
    areaId: 'a2', label: 'Learning', showingUp: 1, participating: 1,
  });
});

test('an area nobody has a goal in reports zero of zero', () => {
  const rows = areaRollup({ areas, goals: [], checkinsByGoal: {}, now: WED });
  assert.deepEqual(rows, [
    { areaId: 'a1', label: 'Health', showingUp: 0, participating: 0 },
    { areaId: 'a2', label: 'Learning', showingUp: 0, participating: 0 },
  ]);
});

test('circle activity streak counts consecutive days with any check-in', () => {
  assert.equal(circleActivityStreak(['2026-08-05', '2026-08-04', '2026-08-03'], WED), 3);
  // One member checking in is enough to keep it alive - it measures
  // aliveness, not health, and cannot shame anyone.
  assert.equal(circleActivityStreak(['2026-08-04', '2026-08-04', '2026-08-03'], WED), 2);
});

test('circle activity streak survives a today with no check-in yet', () => {
  assert.equal(circleActivityStreak(['2026-08-04', '2026-08-03'], WED), 2);
  assert.equal(circleActivityStreak([], WED), 0);
});
