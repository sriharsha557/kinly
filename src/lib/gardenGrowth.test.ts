import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthStageCrossed, growthVisual } from './gardenGrowth.ts';

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

test('growthVisual agrees with the crossing thresholds', () => {
  assert.equal(growthVisual(0).stage, 'seed');
  assert.equal(growthVisual(2).stage, 'seed');
  assert.equal(growthVisual(3).stage, 'sprout');
  assert.equal(growthVisual(13).stage, 'sprout');
  assert.equal(growthVisual(14).stage, 'tree');
  assert.equal(growthVisual(29).stage, 'tree');
  assert.equal(growthVisual(30).stage, 'bloom');
});

// The property the whole feature rests on: every check-in makes the plant
// bigger, and none ever makes it smaller. A band that restarted low would
// shrink the plant at the exact moment of promotion.
test('scale never decreases as a streak grows', () => {
  let previous = -Infinity;
  for (let streak = 0; streak <= 400; streak += 1) {
    const { scale } = growthVisual(streak);
    assert.ok(scale >= previous, `scale dropped at streak ${streak}: ${scale} < ${previous}`);
    previous = scale;
  }
});

// "Continuous" here means no visible seam: crossing a boundary must not be a
// bigger jump than an ordinary day within the band leading up to it. Testing
// against a fixed number instead would just be re-asserting the band widths.
test('crossing a band boundary is no larger a step than an ordinary day', () => {
  for (const boundary of [3, 14, 30]) {
    const ordinaryStep = growthVisual(boundary - 1).scale - growthVisual(boundary - 2).scale;
    const boundaryStep = growthVisual(boundary).scale - growthVisual(boundary - 1).scale;
    assert.ok(
      boundaryStep <= ordinaryStep + 1e-9,
      `seam at ${boundary}: boundary step ${boundaryStep} > ordinary step ${ordinaryStep}`,
    );
  }
});

test('scale is capped so a long streak cannot break the row layout', () => {
  assert.equal(growthVisual(60).scale, growthVisual(400).scale);
  assert.ok(growthVisual(400).scale <= 1.06);
});

test('a zero or negative streak sits at the floor', () => {
  assert.equal(growthVisual(0).scale, 0.8);
  assert.equal(growthVisual(-5).scale, 0.8);
  assert.equal(growthVisual(-5).stage, 'seed');
});
