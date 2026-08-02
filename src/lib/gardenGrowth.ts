// The garden's growth model: the single owner of the 3/14/30 streak
// thresholds and of how a streak becomes something visible.
//
// It used to own only the crossing detection, with useGarden.stageFor()
// keeping a hand-synchronized second copy of the same numbers - the header
// here said as much ("the thresholds mirror stageFor exactly"). stageFor now
// calls growthVisual(), so the table below is the only copy.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

// The four stages a streak can produce. 'wilted' is deliberately not here:
// it is a function of elapsed time rather than streak, so it stays in
// useGarden alongside the calendarDaysSince check it shares with
// needsAttention.
export type GrowthStage = 'seed' | 'sprout' | 'tree' | 'bloom';

const THRESHOLDS: readonly (readonly [number, GrowthStage])[] = [
  [30, 'bloom'],
  [14, 'tree'],
  [3, 'sprout'],
];

// Where each stage's art starts and ends on the size curve. The bands are
// contiguous - sprout picks up exactly where seed left off - because the
// scale has to be monotonic in the streak: if every band restarted low,
// crossing into 'tree' would visibly *shrink* the plant at the precise
// moment it was being rewarded.
const BANDS: readonly { stage: GrowthStage; from: number; to: number; min: number; max: number }[] = [
  { stage: 'seed', from: 0, to: 3, min: 0.8, max: 0.86 },
  { stage: 'sprout', from: 3, to: 14, min: 0.86, max: 0.93 },
  { stage: 'tree', from: 14, to: 30, min: 0.93, max: 1.0 },
  // Past 60 days the curve flattens rather than growing forever - an
  // uncapped scale would break the plant row's layout on a long streak.
  { stage: 'bloom', from: 30, to: 60, min: 1.0, max: 1.06 },
];

export interface GardenVisual {
  stage: GrowthStage;
  scale: number;
}

// Everything a streak says about how its plant should look. Returns a struct
// rather than a bare number so later additions (leaf density, flower count,
// blossom brightness) are additive here instead of becoming another copy of
// the thresholds at the call site.
export function growthVisual(streak: number): GardenVisual {
  const s = Number.isFinite(streak) ? Math.max(0, streak) : 0;
  const band = BANDS.find((b) => s < b.to) ?? BANDS[BANDS.length - 1];
  const span = band.to - band.from;
  // Clamped because the final band is entered, not exited: a 400-day streak
  // lands here with s far past `to`.
  const t = Math.min(1, Math.max(0, (s - band.from) / span));
  return { stage: band.stage, scale: band.min + (band.max - band.min) * t };
}

// Detects a garden stage advance at log time (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). Stage is derived live and never
// persisted, so this is the only way to notice a transition without a
// diffing job.
//
// Growth only, never wilting: wilting is a passage of time rather than an
// action, so it would need a scheduled sweep, and MoodCheckinCard's "no
// shame mechanics" rule says a garden should not announce a member's
// decline to their friends.
//
// Both arguments are the member's *maximum* streak across every goal they
// hold in the circle, before and after the log - stage follows the max, so
// beating your own second-best goal changes nothing.
export function growthStageCrossed(previousMax: number, newMax: number): GrowthStage | null {
  if (newMax <= previousMax) return null;
  const crossed = THRESHOLDS.find(([threshold]) => newMax >= threshold && previousMax < threshold);
  return crossed ? crossed[1] : null;
}
