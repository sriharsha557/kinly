# Beta scope reduction: feature flags, four tabs, reachable tutorial

Date: 2026-08-07
Status: approved, not yet implemented

## Problem

Kinly exposes roughly 25 features across five tabs. Tester feedback is that
there are too many options and no obvious place to start. Two of those
features were also reachable only through a bare `▼` chevron with no label,
so they were simultaneously overwhelming in aggregate and undiscoverable
individually.

The goal is a beta that teaches one idea — *grow together with your circle* —
without deleting work that is finished and paid for.

## Decisions

**Scope.** Keep the goals + circle-accountability loop. Hide the delight
features behind flags, to return in later phases.

Visible: Today's Mission, mood check-in, Goals, Areas of Growth, Circle
Health, Members, Garden, Challenges, Buddy, Ask Friends, Health Connect,
Profile & Settings.

Hidden: Would You Rather, Guess Who, Vision Board, Meetups, Circle AI Ideas,
Weekly Recap, Daily Circle Card.

**Flags, not commented code.** Commented-out blocks stop being typechecked
and linted and drift out of sync within a release or two; git already
preserves history perfectly. A flag module keeps every hidden feature
compiling and type-safe, so re-enabling is a one-line edit rather than an
archaeology exercise.

**Phasing.** Phase 1 is the four-tab MVP. Phase 2 restores Guess Who and
Daily Circle Card. Phase 3 restores Would You Rather, Vision Board, Meetups,
Weekly Recap, and Circle AI Ideas. Guess Who is explicitly a *deferral*, not
a retirement — it is the strongest social differentiator in the set and was
repaired on 2026-08-07 (commit 259c6a6).

**Navigation.** Remove the Connection tab. With Circle Card and both games
hidden it holds only Ask Friends, which does not justify a top-level
destination. Ask Friends moves into the Circle tab below Buddy. Five tabs
become four: Today, Goals, Circle, Profile.

## Design

### 1. Flag module — `src/lib/features.ts`

```ts
export type FeatureFlag =
  | 'guessWho'
  | 'circleCard'
  | 'wouldYouRather'
  | 'visionBoard'
  | 'meetups'
  | 'circleAI'
  | 'weeklyRecap';

export const FEATURES: Record<FeatureFlag, boolean> = {
  // Phase 2
  guessWho: false,
  circleCard: false,
  // Phase 3
  wouldYouRather: false,
  visionBoard: false,
  meetups: false,
  circleAI: false,
  weeklyRecap: false,
};
```

Typed as `Record<FeatureFlag, boolean>` rather than `as const` on purpose: a
literal `false` type narrows every guarded branch to `never`, which suppresses
typechecking inside exactly the code the flags are meant to keep healthy.

Build-time constants, not remote config. Nothing in the beta needs to toggle a
feature without a release, and remote config would add failure modes (fetch
failure, flag drift between devices) for no current benefit.

### 2. Gating

Each hidden feature is gated at its single call site, so the component files
themselves stay untouched and independently testable:

| Feature | Call site |
|---|---|
| Vision Board | `CircleScreen.tsx` |
| Meetups | `CircleScreen.tsx` |
| Circle AI Ideas | `CircleScreen.tsx` |
| Weekly Recap | `CircleScreen.tsx` |
| Daily Circle Card | `ConnectionScreen.tsx` (moves with the merge) |
| Would You Rather | `ConnectionScreen.tsx` (moves with the merge) |
| Guess Who | `ConnectionScreen.tsx` (moves with the merge) |

All four children of the "More for your circle" `DisclosureSection` are on the
hide list, so that section is removed outright rather than left rendering an
empty shell. Same for "Light Moments".

### 3. Tab merge

`ConnectionScreen.tsx` currently holds the Ask Friends UI inline — `AskCard`
and `ReplyThread` are defined in the screen file alongside the composer. That
UI extracts to `src/components/AskFriendsSection.tsx`, which the Circle tab
renders below `BuddyCard`.

`ConnectionScreen.tsx` is then deleted, and its `Tab.Screen` removed from
`MainTabs.tsx`. `QuickActionsRow.tsx:25` is the only caller
targeting that tab (verified by grep across `src/`); its "Ask Friends"
action repoints at `Circle`.

This extraction is the bulk of the work and the main risk: the screen is
~400 lines and mixes composer state, moderation sheets, and reply threading.

To keep the component boundary and the navigation change from ever being in
flight together, the extraction proceeds in place first:

1. Fix the Ask Friends refresh bug (issue 14) while the code is still where
   the bug was reported.
2. Extract `AskFriendsSection`, still rendered inside `ConnectionScreen`.
3. Verify nothing changed — same screen, same behaviour.
4. Render the same component inside the Circle tab.
5. Remove the Connection tab and repoint `QuickActionsRow`.
6. Delete `ConnectionScreen.tsx` once the Circle placement is stable.

Each step is independently verifiable, and a regression at any point has
exactly one candidate cause.

### 4. Reachable tutorial

`TutorialScreen` already exists (four illustrated slides) but renders only
when `!user && !hasSeenTutorial`, so it is unreachable after first sign-in.
Add it as a route reachable from Profile via "Help & Getting Started",
preserving the existing `onFinish` contract.

### 5. Disclosure affordance

After the cut, only "Advanced" in `CircleSettingsScreen` still uses
`DisclosureSection`. Replace the bare `▼` / `▲` glyph with a text affordance
("Show" / "Hide") so the control states what it does.

## Out of scope

Tracked, but not part of this work:

- **Ask Friends does not refresh after posting** (issue 14). Root cause not
  yet found; the obvious explanation — a mismatched query key — is ruled out.
  Must be fixed *before* the extraction, so the bug does not get attributed to
  the move.
- **Actionable join-request notifications** (issue 16). Needs notification
  action categories on both platforms plus a background approval handler.
  Its own project.
- **The unlabelled share toggle after finishing a goal.** Not reproduced;
  awaiting the screen name from the reporter.

## Delivery phases

1. **Stabilization** — fix Ask Friends refresh, Health Connect, the check-in
   screen, and session-timeout handling. Verify every core flow.
2. **Simplification** — add the flag module, gate the hidden features, remove
   the two emptied disclosure sections.
3. **Navigation** — the six-step extraction above.
4. **Polish** — reachable tutorial, textual affordance on the remaining
   "Advanced" disclosure, loading/success feedback on any surface still
   lacking it.

Already shipped to `preview` on 2026-08-07, ahead of this plan: Guess Who
repaired (259c6a6), challenge progress labelled and attributed to members
(c9b377d), Circle Card answer gate stated (786e065). Phase 1 and Phase 4 do
not need to revisit those.

Phase 1 carries the only genuinely unknown work: Health Connect, the check-in
screen, and session timeout have not been root-caused yet, so they can be
sequenced but not yet estimated or specified.

## Verification

- `tsc --noEmit` clean, `npm test` green, `expo lint` clean.
- Every hidden feature still typechecks — flipping any flag to `true` must
  restore a working surface with no other edit.
- Manual: four tabs; Ask Friends posts and replies work under Circle; the
  tutorial opens from Profile and returns cleanly; no empty disclosure shells.
- Ship to the `preview` channel for tester confirmation.
