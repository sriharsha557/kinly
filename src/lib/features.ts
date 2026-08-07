// Build-time feature gates for the beta. Tester feedback was that ~25
// features across five tabs is overwhelming with no obvious starting point,
// so everything outside the goals + circle-accountability loop is deferred.
//
// Flags rather than commented-out code on purpose: a commented block stops
// being typechecked and linted and drifts out of sync within a release or
// two, and git already preserves history perfectly. Gated this way, every
// deferred feature keeps compiling, so re-enabling it is a one-line edit
// rather than an archaeology exercise.
//
// Deliberately typed Record<FeatureFlag, boolean> and NOT `as const`: a
// literal `false` type narrows every guarded branch to `never`, which would
// suppress typechecking inside exactly the code these flags exist to keep
// healthy.
//
// Build-time constants, not remote config. Nothing in the beta needs to
// toggle without a release, and remote config would add failure modes (fetch
// failure, flag drift between devices) for no current benefit.
export type FeatureFlag =
  | 'guessWho'
  | 'circleCard'
  | 'wouldYouRather'
  | 'visionBoard'
  | 'meetups'
  | 'circleAI'
  | 'weeklyRecap';

export const FEATURES: Record<FeatureFlag, boolean> = {
  // Phase 2 - first back. Guess Who is a deferral, not a retirement: it is
  // the strongest social differentiator in the set, and it was repaired on
  // 2026-08-07 (commit 259c6a6) after being broken by an ambiguous PostgREST
  // embed that 400'd every fetch.
  guessWho: false,
  circleCard: false,

  // Phase 3 - delight features, back once the core experience is polished.
  wouldYouRather: false,
  visionBoard: false,
  meetups: false,
  circleAI: false,
  weeklyRecap: false,
};
