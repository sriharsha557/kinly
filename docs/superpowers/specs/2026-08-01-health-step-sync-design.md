# Health Connect step sync — connect once, then it just happens

**Date:** 2026-08-01
**Status:** Approved design, ready for implementation planning

## Problem

Kinly can already read a daily step count from Health Connect and log it against a goal. Almost nobody will ever find it.

The only way in is a `ToggleSwitch` inside the add-goal form, labelled *"Track automatically with Health Connect (steps)"*. Three things are wrong with that:

1. **It is offered where it cannot be explained.** A switch in a form has no room to say what Health Connect is, why Kinly wants it, or what it will read. It is also the only mention of the feature anywhere in the app — no onboarding, no settings.
2. **It is offered when it cannot work.** The switch renders on every Android device, whether or not Health Connect is installed. Turn it on without it and you get a goal that silently never syncs, with nothing on screen to explain why.
3. **The permission is requested from the wrong place.** `useSyncStepGoals` calls `requestStepsReadPermission()` inside its effect, so Android's health-permission dialog appears when you open the Goals tab — unprompted, unexplained, and indistinguishable from a bug. `MOBILE_APP_LEARNINGS.md`'s UI-states checklist names this exact failure: *"a denied permission must look different from the user simply cancelling"*.

And separately: **syncing only runs while the Goals screen is focused**, so a walking goal's progress — and the garden and Home's mission list that derive from it — stay stale until you happen to visit that tab.

## Governing principle

> **Connect once, and step goals log themselves.**

Sync is a property of the device, not of each goal. The user's decision is "should Kinly read my steps?", asked once, in a place with room to explain it.

## The connection

One device-level connection replaces the per-goal toggle entirely.

### Offered in onboarding

A new step, shown **only** when `Platform.OS === 'android'` **and** `getHealthConnectStatus()` returns `'available'`. Every other user — iOS, or Android without Health Connect installed — never sees it, and the step count adjusts so they are not shown a dot for a step that does not exist.

Onboarding's existing steps are gated on profile nullness (`interests === null`, then `theme_accent === null`, then the circle step). The health step slots in **between theme and circle**: the circle step ends onboarding by joining or creating, so anything after it would never run.

Copy:

> **Count your steps for you?**
> Kinly can read your daily step count from Health Connect, so walking goals log themselves.
> **[Connect]** **[Not now]**

"Not now" is remembered. The step is never shown again on that device.

### Lives in Profile settings

A `HealthSyncRow` that always reflects real state, so "why aren't my steps syncing" is answered on screen rather than guessed at:

| Status | Row reads | Control |
|---|---|---|
| Connected | "Reads today's step count from Health Connect" | switch, on |
| Available, not connected | "Log walking goals automatically" | switch, off |
| `needs-install` | "Health Connect isn't installed on this phone" | **Install** → `openHealthConnectSettings()` |
| Permission denied | "Kinly doesn't have permission to read steps" | **Fix in Settings** → `openHealthConnectSettings()` |
| `unavailable` (incl. all iOS) | *row is not rendered at all* | — |

Permission is requested **only** when the user taps Connect or flips the switch on — never from inside a sync effect.

### Stored where the theme is stored

A device-local preference, following `src/lib/themePrefs.ts`'s pattern of a single write path used by both onboarding and settings:

```ts
type HealthSyncDecision = 'connected' | 'declined' | null; // null = never asked
```

Device-local rather than on the profile row, because the connection *is* device-specific: Health Connect exists on one phone, and the same account on another phone has a genuinely different answer. This is the one place this design deliberately diverges from the theme pattern it otherwise copies.

## Detection: which goals sync

With the per-goal toggle gone, something has to decide. A new pure module, `src/lib/stepGoal.ts`:

```ts
export function isStepGoal(title: string, target: number): boolean;
```

**True when the title mentions steps AND the target is at least 1,000.**

The target guard is doing real work. Without it, "Steps to launch my business" with a target of 5 would silently start logging itself from the user's pedometer and complete on its own. Step goals are always in the thousands; sentences that merely contain the word "step" are not.

The built-in suggestion *"Walk 8,000 steps daily"* (`src/lib/suggestions.ts`, category `health`, target 8000) satisfies both conditions, so tapping it always produces a synced goal without needing a special case.

`useCreateGoal` calls this and sets `goal_source` to `'health_steps'` or `'manual'` accordingly — but **only when the device is connected**. On a device that never connected, every goal is `'manual'`, so nothing is marked for a sync that cannot happen.

### Connecting converts the goals you already have

Detection at creation time alone would break the promise for the commonest case: someone creates "Walk 8,000 steps daily" on day one, discovers step sync a week later, connects — and that goal keeps needing to be logged by hand, because it was created as `'manual'`.

So connecting runs a one-off pass over the user's existing goals in the active circle and flips every `'manual'` goal matching `isStepGoal` to `'health_steps'`. They gain the Auto badge like any other, so the undo applies equally. This runs on connect only, never on ordinary app start.

Disconnecting does **not** convert anything back. Goals keep `goal_source = 'health_steps'`; the sync hook is gated on the connection, so they simply stop updating and are logged by hand until the user reconnects. Converting on disconnect would silently rewrite data in response to a permission change, and would lose the user's earlier per-goal undos.

Unit-tested with `node:test`, matching `needsAttention` / `moments` / `gardenGrowth` / `tiers`: positive cases, the sub-1,000 guard, the business-plan false positive, case-insensitivity, and the canonical suggestion.

## The undo

An auto-detected goal shows a badge on its card in `GoalsScreen`:

```
Walk 8,000 steps daily
████████░░░  6,240/8,000
[ Auto · Health Connect  ✕ ]
```

Tapping ✕ sets `goal_source` back to `'manual'`. It stops syncing and becomes a normal goal you log by hand.

This is a **correction** affordance, not setup — the point is that a heuristic's wrong guess costs one tap to fix. There is deliberately no way to turn sync *on* for an arbitrary goal: that would be the per-goal toggle again, and the whole design is that you connect once and stop thinking about it.

**The badge renders only while the device is connected.** A `health_steps` goal on a disconnected device is not being auto-tracked, so labelling it "Auto" would be a lie — it shows as an ordinary goal until the connection returns.

## Sync timing

`useSyncStepGoals` moves out of `GoalsScreen` and up to the navigator, firing **once per app foreground** via React Native's `AppState`.

Today it runs on Goals-screen focus only, so a walking goal's progress — and everything derived from it, the garden's stage and health, Home's mission list, the Circle tab's member rows — is stale until the user visits that one tab. Foreground-driven means every surface agrees the moment the app opens, from one Health Connect read rather than one per screen visit.

The hook additionally becomes a no-op unless the device is connected, so an unconnected device never touches the native module at all.

**Not doing background sync.** It would need a background-task native module, a new build, and battery/OS-throttling handling — materially bigger than the rest of this feature combined, for the narrow benefit of steps landing without the app being opened.

## What changes

**New:**
- `src/lib/stepGoal.ts` + `src/lib/stepGoal.test.ts`
- `src/lib/healthSyncPrefs.ts` — the single write path, mirroring `themePrefs.ts`
- `src/state/useHealthSyncStore.ts` — persisted device-local decision
- `src/components/HealthSyncRow.tsx` — the Profile settings row, all five states
- A health step in `OnboardingScreen`

**Changed:**
- `useSyncStepGoals` — foreground-driven, gated on the connection, no permission request inside it
- `useCreateGoal` — sets `goal_source` from `isStepGoal` when connected
- `GoalsScreen` — the add-goal toggle is deleted; the Auto badge is added
- `ProfileScreen` — mounts `HealthSyncRow`

**Unchanged:**
- `src/lib/healthConnect.ts` itself — its four functions are already the right surface
- The `health_steps` value, the `sync_step_goal` RPC, migration `0033`
- Everything on iOS: the lazy import means the native module is still never touched there

**No schema change.** `goal_source` already exists and already carries both values.

## Out of scope

- **iOS / HealthKit.** A separate integration with a different permission model. The current code is Android-only by design, and half-building the iOS side now would be worse than not starting it.
- **Background sync.** See above.
- **Health data beyond steps.** Sleep, heart rate and workouts are each their own permission and their own "what does the circle see" privacy decision.
- **Showing raw step counts to the circle.** Members see goal progress, exactly as they do for manual goals. Sharing raw health numbers is a privacy decision this design does not make.

## Success criteria

- An Android user with Health Connect is offered step sync once, during onboarding, with an explanation — and can change their mind later in Profile.
- After connecting, creating a walking goal requires no further setup for it to log itself.
- A user whose steps are not syncing can find out why from the Profile row, without guessing.
- The permission dialog only ever appears immediately after the user asks for it.
- A goal wrongly detected as a step goal is one tap from being manual again.
- No iOS user, and no Android user without Health Connect, is shown any of it.
