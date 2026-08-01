// Decides whether a goal should be logged automatically from the device's
// step count (docs/superpowers/specs/2026-08-01-health-step-sync-design.md).
//
// This replaces a per-goal toggle the user used to flip by hand, so it is
// guessing on their behalf - and a wrong guess is not harmless. A goal
// wrongly marked as a step goal starts filling itself in from a pedometer
// and can complete without the user doing the thing they meant to do.
//
// Hence two conditions, not one. "Steps to launch my business" contains the
// word; what it does not have is a target in the thousands, because real
// step goals always do. Requiring both is what makes the guess safe enough
// to make silently. GoalsScreen's Auto badge is the escape hatch for the
// cases this still gets wrong.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

// Word-boundary matched: "stepping" and "stepped" are not step counts, and
// substring matching would claim both.
const STEPS_PATTERN = /\bsteps?\b/i;

// Real step goals are in the thousands. A "steps" goal targeting 5 is a
// checklist, not a pedometer.
const MIN_STEP_TARGET = 1000;

export function isStepGoal(title: string, target: number): boolean {
  return STEPS_PATTERN.test(title) && target >= MIN_STEP_TARGET;
}
