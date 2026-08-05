import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalDate,
  toIsoDate,
  isoWeekday,
  startOfWeek,
  startOfMonth,
  daysRemainingInWeek,
  daysRemainingInMonth,
  addDays,
} from './periods.ts';

// 2026-08-05 is a Wednesday.
const WED = '2026-08-05';

test('toLocalDate anchors to local midnight, not UTC', () => {
  const d = toLocalDate(WED);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 5);
  assert.equal(d.getHours(), 0);
});

test('toIsoDate round-trips toLocalDate', () => {
  assert.equal(toIsoDate(toLocalDate(WED)), WED);
  assert.equal(toIsoDate(toLocalDate('2026-01-01')), '2026-01-01');
});

test('isoWeekday numbers Monday 1 through Sunday 7', () => {
  assert.equal(isoWeekday(toLocalDate('2026-08-03')), 1); // Monday
  assert.equal(isoWeekday(toLocalDate(WED)), 3);
  assert.equal(isoWeekday(toLocalDate('2026-08-09')), 7); // Sunday
});

test('weeks start on Monday', () => {
  assert.equal(toIsoDate(startOfWeek(toLocalDate(WED))), '2026-08-03');
  // Sunday belongs to the week that opened the previous Monday.
  assert.equal(toIsoDate(startOfWeek(toLocalDate('2026-08-09'))), '2026-08-03');
  assert.equal(toIsoDate(startOfWeek(toLocalDate('2026-08-10'))), '2026-08-10');
});

test('daysRemainingInWeek counts today as still available', () => {
  assert.equal(daysRemainingInWeek(toLocalDate('2026-08-03')), 7); // Monday
  assert.equal(daysRemainingInWeek(toLocalDate(WED)), 5);
  assert.equal(daysRemainingInWeek(toLocalDate('2026-08-09')), 1); // Sunday
});

test('month boundaries and remaining days', () => {
  assert.equal(toIsoDate(startOfMonth(toLocalDate(WED))), '2026-08-01');
  assert.equal(daysRemainingInMonth(toLocalDate(WED)), 27); // 5th..31st
  assert.equal(daysRemainingInMonth(toLocalDate('2026-08-31')), 1);
  assert.equal(daysRemainingInMonth(toLocalDate('2026-02-01')), 28);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(toIsoDate(addDays(toLocalDate('2026-08-31'), 1)), '2026-09-01');
  assert.equal(toIsoDate(addDays(toLocalDate('2026-01-01'), -1)), '2025-12-31');
});
