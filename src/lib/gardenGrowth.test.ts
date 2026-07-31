import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthStageCrossed } from './gardenGrowth.ts';

test('crossing 3 sprouts', () => {
  assert.equal(growthStageCrossed(2, 3), 'sprout');
});

test('crossing 14 grows a tree', () => {
  assert.equal(growthStageCrossed(13, 14), 'tree');
});

test('crossing 30 blooms', () => {
  assert.equal(growthStageCrossed(29, 30), 'bloom');
});

test('a streak that grows without crossing anything reports nothing', () => {
  assert.equal(growthStageCrossed(4, 5), null);
  assert.equal(growthStageCrossed(14, 15), null);
});

test('landing exactly on a threshold you were already past reports nothing', () => {
  assert.equal(growthStageCrossed(30, 30), null);
});

test('a jump past several thresholds reports only the highest reached', () => {
  assert.equal(growthStageCrossed(1, 30), 'bloom');
  assert.equal(growthStageCrossed(1, 14), 'tree');
});

test('a streak that resets reports nothing - growth only, never wilting', () => {
  assert.equal(growthStageCrossed(30, 1), null);
  assert.equal(growthStageCrossed(14, 0), null);
});
