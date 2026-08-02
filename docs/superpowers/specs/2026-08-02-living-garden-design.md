# Making the Garden feel alive — design

**Date:** 2026-08-02
**Status:** implemented (branch `living-garden-feedback`), not yet verified on a device
**Surface:** `GardenHero`, rendered only on Home (`TodayScreen.tsx:491`)

## Problem

The Garden is Kinly's differentiator, but today it is inert in two specific ways.

**It does not respond to a check-in.** `useLogGoalProgress` invalidates
`['goals', circleId]` on every mutation and never `['garden', circleId]`
(`useGoals.ts:80`). Logging a goal therefore leaves the hero untouched until some
later refetch happens to run. The one action the whole product is built around
produces no visible change in the thing that represents it.

**It only changes at three moments, ever.** Stage art is a step function of the
member's max streak at 3 / 14 / 30 (`useGarden.ts:29-32`). A member on day 8
renders identically to day 3 — eleven consecutive check-ins with no visual
reward. Growth is the promise; the picture holds still.

A third, smaller problem: every plant sways at exactly ±1.5° / 1500ms, separated
only by `index * 400` (`GardenHero.tsx:96-106`). Uniform period and amplitude
read as mechanical rather than alive. That loop also runs whenever the component
is mounted, including while the user is on another tab.

## Non-goals

Deliberately excluded, after weighing them against a pre-beta roadmap: ambient
visitors (birds, butterflies, fireflies), seasons, real weather, and anything
requiring location. Those are decorative; they do not strengthen the
check-in → response → return loop. Growth feedback does, so it gets the effort
instead.

Location is excluded on its own merits too — see "Daylight" below.

## Design

### Structure

`GardenHero.tsx` is 317 lines and mixes composition, plant internals, weather
selection, status copy, and styles. Split into `src/components/garden/`:

| File | Responsibility |
| --- | --- |
| `GardenHero.tsx` | Composition and data only |
| `SkyGradient.tsx` | The two-layer sky |
| `PlantRow.tsx` | The scrolling row, sizing, staggered entrance |
| `Plant.tsx` | One member: sway, droop, stage pop, growth scale |
| `GardenFooter.tsx` | Title, status copy, status meta |

`GardenHero`'s body becomes declarative:

```tsx
<SkyGradient phase={phase}>
  <PlantRow members={members} />
  <GardenFooter ... />
</SkyGradient>
```

Pure logic lives in `src/lib/`, dependency-free so `node:test` can import it
under `--experimental-strip-types` — the convention `gardenGrowth.ts:11`
already sets.

### Growth: one module owns the thresholds

`gardenGrowth.ts` already holds the 3 / 14 / 30 table, and its header comment
concedes the duplication: *"The thresholds mirror `useGarden.stageFor()`
exactly."* Two hand-synchronized copies. This design consolidates rather than
adding a third.

```ts
export interface GardenVisual {
  stage: GrowthStage;  // 'seed' | 'sprout' | 'tree' | 'bloom'
  scale: number;
}

export function growthVisual(streak: number): GardenVisual;
```

`growthVisual` is the single reader of `THRESHOLDS`. `growthStageCrossed` keeps
using the same table. `useGarden.stageFor()` reduces to the wilted check plus
`growthVisual(maxStreak).stage`.

`GrowthStage` widens from `sprout | tree | bloom` to include `seed`, so it names
the four streak-derived stages. `wilted` stays in the hook: it is a function of
elapsed time, not streak, and belongs with the `calendarDaysSince` check it
already shares with `needsAttention`.

The struct return exists so `leafDensity`, `flowerCount`, and
`blossomBrightness` can be added later without touching callers or copying
thresholds again. Only `scale` and `stage` are implemented now.

#### The scale curve

| Stage | Streak | Scale |
| --- | --- | --- |
| seed | 0–2 | 0.80 → 0.86 |
| sprout | 3–13 | 0.86 → 0.93 |
| tree | 14–29 | 0.93 → 1.00 |
| bloom | 30–60 | 1.00 → 1.06 (capped) |

Linear within each band, continuous across boundaries.

Monotonicity is a hard requirement, not an aesthetic preference: if each band
restarted low, crossing into `tree` would *shrink* the plant at the exact moment
of reward. The cap at 60 days keeps a 400-day streak from breaking the row
layout. Streaks below 0 clamp to 0.80.

### The check-in moment

`useLogGoalProgress.onSuccess` also invalidates `['garden', circleId]`. This is
the change the rest of the design rests on — without it the plant cannot move
when you check in.

In `Plant`, when `member.streak` increases while mounted, scale springs to its
new value (`withSpring`, `damping: 14`). When it does not change, nothing
animates — including on first mount, following the rule already stated at
`GardenHero.tsx:112-117` that data display is not an event.

One mechanism, three tiers of response:

- **Every check-in** — your plant grows a visible step, immediately.
- **Day 3 / 14 / 30** — the existing `ZoomIn` stage pop fires *and* scale
  continues upward past it.
- **A friend's check-in** — their plant grows when you next open Home. There are
  no realtime channels in this codebase, so this is on refetch, by design.

### Daylight

`daylightPhase(date, solar?): 'dawn' | 'day' | 'dusk' | 'night'`

Clock-based boundaries in the device's local time: dawn 05–08, day 08–17,
dusk 17–20, night 20–05.

Solar sunrise/sunset was considered and rejected *for now*: it requires
latitude, there is no hemisphere-agnostic substitute, and the app requests no
location permission today. Adding a permission prompt pre-beta to move a
gradient by ~40 minutes is a bad trade. The optional `solar` parameter exists so
that if sunrise/sunset ever arrives from a feature that legitimately needs
location, this becomes an argument change inside a pure function with its own
tests — not a rewrite.

`useDaylight()` recomputes on focus and every 5 minutes while focused. No timer
runs in the background.

### Sky

`REDESIGN.md:42` is explicit that the garden's foliage and soil never follow the
accent, and that the accent drives *the hero's sky tint*. Replacing the gradient
with fixed dawn/dusk hues would delete the accent's only expression in the hero.

So the sky is two layers: the existing accent gradient
(`inputBg → background`) unchanged underneath, and a phase overlay above it.

| Phase | Overlay | Alpha |
| --- | --- | --- |
| dawn | warm rose | 0.08 |
| day | none | — |
| dusk | amber | 0.10 |
| night | deep indigo | 0.12 |

Alphas are deliberately low. The garden should read as peaceful, not dramatic,
and a heavier overlay would fight the calm register the rest of the app was just
tuned to.

New token group `theme.garden.sky[phase]` per scheme, alongside the existing
fixed nature hues — the exception `PRINCIPLES.md` already sanctions. No raw hex
in components.

Day being transparent means the common midday case renders pixel-identically to
today.

Contrast, measured rather than assumed. `textPrimary` stays above 11:1 in every
phase and scheme. The worst case for `textSecondary` — which is what
`plantStreak` uses — is the night wash in the light scheme:

| Position in the wash | Alpha | Contrast |
| --- | --- | --- |
| top stop | 0.120 | 4.26 |
| plant labels, ~70% down | 0.071 | 4.61 |
| bottom stop | 0.050 | 4.76 |

The labels clear 4.5:1 where they actually sit. The 4.26 figure occurs only at
the top of the hero, where the sky is and no text is. Unwashed, the same pair
is 5.15, so the night sky costs roughly half a point of contrast.

The footer sits on opaque `colors.surface` above the wash, so its text is
unaffected in every phase.

### Sway

`swayProfile(userId): { amplitude, period, delay }` hashes the id into
amplitude 1.1–2.0°, period 2600–3800ms, and a phase delay.

Keyed on `userId` rather than row index so a plant keeps its character when the
row reorders, and deterministic so it does not change between renders.

The sway loop is gated with `useIsFocused()`. Today it animates while the user
is on another tab, which is wasted work regardless of this design.

Wilted behavior is unchanged: droop to -8°, no sway.

### Reduced motion

`useReducedMotion()` already gates sway, the stage pop, and the entrance
stagger. Growth scale joins them — it jumps to its value with no spring. The sky
is static in every phase and needs no gating.

### Accessibility

Scale and sky carry no information absent elsewhere. The plant's existing label,
`"${name}'s plant, ${stage}, ${streak} day streak"`, remains the source of
truth and is unchanged. Nothing new is announced.

## Testing

`node:test` files beside their modules, matching `gardenGrowth.test.ts`:

- `gardenGrowth.test.ts` (extended) — `growthVisual` monotonicity across all
  three thresholds, band endpoints, the 60-day cap, zero and negative streaks;
  plus the existing `growthStageCrossed` cases, which must keep passing to prove
  the consolidation preserved behavior.
- `daylight.test.ts` — each boundary hour, the midnight wrap, and the optional
  `solar` path.
- `swayProfile.test.ts` — determinism for a given id, and all three outputs
  inside their declared ranges across a spread of ids.

Component behavior — that a streak increase animates and an unrelated re-render
does not — is not covered by these. This project has no React Native test
harness, and adding one is out of scope here; that behavior is verified by
running the app.

## Files

**New:** `src/components/garden/{GardenHero,SkyGradient,PlantRow,Plant,GardenFooter}.tsx`,
`src/hooks/useDaylight.ts`, `src/lib/daylight.ts`, `src/lib/swayProfile.ts`, and
the two new test files.

**Modified:** `src/lib/gardenGrowth.ts` (+ its test), `src/hooks/useGarden.ts`
(`stageFor` delegates, `MemberGardenState` unchanged), `src/hooks/useGoals.ts`
(garden invalidation), `src/theme/colors.ts` (`garden.sky`),
`src/screens/TodayScreen.tsx` (import path).

**Deleted:** `src/components/GardenHero.tsx`, replaced by the `garden/` folder.

`src/components/GardenStageArt.tsx` stays where it is. It is shared beyond the
hero — `CircleHealthCard` and `CircleMembersSection` both render it on the
Circle screen — so it is not a garden-hero internal. Those two callers pass a
stage only and are unaffected by the scale curve.

## What changed during implementation

Three departures from the design above, recorded so the spec matches what
shipped.

**`useSyncStepGoal` got the garden invalidation too.** The design named only
`useLogGoalProgress`, but the health-step sync writes the same `streak_count`
and `last_logged_date` columns through a different RPC, so it had the identical
staleness bug by a second route.

**The plant art pivots at `transformOrigin: 'bottom center'`.** Not in the
design, and wrong without it: both the lean and the growth spring otherwise
pivot about the art's centre, so a plant leans from its waist and grows
downward into the soil as much as upward.

**The sway hash needed an avalanche finalizer.** Plain FNV-1a ends in a
multiply, which only propagates a change upward through the word, so ids
differing in their final character — which circle members' UUIDs routinely do —
came out about 1/255 apart in the byte feeding `period`. That is a 5ms spread
across a 1200ms range: the near-lockstep the module exists to break. With
MurmurHash3's fmix32 appended, the mean spread between adjacent ids goes from
0.059 to 0.367 of the range, against the ~0.33 a uniform spread gives.

## Verification status

`npm test` passes 111/111, and `tsc --noEmit` and `expo lint` are clean.

Not verified: nothing in this change has been seen running. The growth spring,
the sway variation and the four skies are unexercised on a device — the
component behavior the Testing section above explicitly leaves to running the
app. No emulator or connected device was available, and reaching the Garden
also requires signing in as a user who belongs to a circle.
