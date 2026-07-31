// Detects a garden stage advance at log time (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). The thresholds mirror
// useGarden.stageFor() exactly - stage is derived live and never persisted,
// so this is the only way to notice a transition without a diffing job.
//
// Growth only, never wilting: wilting is a passage of time rather than an
// action, so it would need a scheduled sweep, and MoodCheckinCard's "no
// shame mechanics" rule says a garden should not announce a member's
// decline to their friends.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export type GrowthStage = 'sprout' | 'tree' | 'bloom';

const THRESHOLDS: readonly (readonly [number, GrowthStage])[] = [
  [30, 'bloom'],
  [14, 'tree'],
  [3, 'sprout'],
];

// Both arguments are the member's *maximum* streak across every goal they
// hold in the circle, before and after the log - stage follows the max, so
// beating your own second-best goal changes nothing.
export function growthStageCrossed(previousMax: number, newMax: number): GrowthStage | null {
  if (newMax <= previousMax) return null;
  const crossed = THRESHOLDS.find(([threshold]) => newMax >= threshold && previousMax < threshold);
  return crossed ? crossed[1] : null;
}
