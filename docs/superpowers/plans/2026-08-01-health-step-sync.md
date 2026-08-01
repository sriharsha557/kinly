# Health Connect Step Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-goal Health Connect toggle buried in the add-goal form with one device-level connection — offered in onboarding, managed in Profile — after which any step goal logs itself.

**Architecture:** A pure, unit-tested `isStepGoal(title, target)` decides which goals sync. A persisted zustand store holds the device's connect/decline decision, and one `useHealthSync` hook is the single write path for changing it — including a one-off pass that converts existing matching goals on connect. `useSyncStepGoals` moves from Goals-screen focus up to the tab navigator, firing once per app foreground, so every surface derived from step data agrees the moment the app opens.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, `react-native-health-connect` (Android-only, lazily imported), zustand + AsyncStorage, React Query, `node:test` with `--experimental-strip-types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-health-step-sync-design.md` governs all behaviour here.
- **Governing principle:** *Connect once, and step goals log themselves.* Sync is a property of the device, not of each goal.
- **Android only.** `healthConnect.ts` lazily imports the native module and returns inert values on iOS. Nothing in this plan may import `react-native-health-connect` directly — always go through `src/lib/healthConnect.ts`, or iOS will try to load a module that does not exist.
- **Never request permission from inside a sync effect.** Permission is requested only in direct response to the user tapping Connect. This is the bug the spec exists to fix.
- **No raw hex in components.** All colour from `useTheme()` tokens (`design/PRINCIPLES.md`); one accent, `colors.primary` for interactive elements only.
- **13px type floor.** Touch targets ≥48dp.
- **No emoji as icons** — the app's own SVG components, which take a `color` prop.
- **No schema change.** `goal_source` already exists and already carries `'manual' | 'health_steps'`.
- **Verification commands:** `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three clean before a task is committed.
- **Test count starts at 54.**
- **Test imports use the explicit `.ts` extension** (`from './stepGoal.ts'`) — Node ESM performs no extension resolution.
- **Every commit message body ends with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

### Task 1: `isStepGoal` — which goals sync

**Files:**
- Create: `src/lib/stepGoal.ts`
- Create: `src/lib/stepGoal.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `isStepGoal(title: string, target: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stepGoal.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStepGoal } from './stepGoal.ts';

test('the built-in walking suggestion is a step goal', () => {
  assert.equal(isStepGoal('Walk 8,000 steps daily', 8000), true);
});

test('a typed steps goal is a step goal', () => {
  assert.equal(isStepGoal('10000 steps every day', 10000), true);
  assert.equal(isStepGoal('Hit my step count', 6000), true);
});

test('matching is case-insensitive', () => {
  assert.equal(isStepGoal('WALK 8000 STEPS', 8000), true);
  assert.equal(isStepGoal('Steps', 5000), true);
});

test('a target under 1000 is never a step goal, whatever the title says', () => {
  // The guard that stops a business plan being logged from a pedometer.
  assert.equal(isStepGoal('Steps to launch my business', 5), false);
  assert.equal(isStepGoal('Next steps for the house move', 10), false);
  assert.equal(isStepGoal('Walk 999 steps', 999), false);
});

test('exactly 1000 is a step goal - the boundary is inclusive', () => {
  assert.equal(isStepGoal('Walk 1000 steps', 1000), true);
});

test('a large target does not make a non-steps goal a step goal', () => {
  assert.equal(isStepGoal('Read 5000 pages', 5000), false);
  assert.equal(isStepGoal('Save 20000 rupees', 20000), false);
});

test('stepping and stepped are not step counts', () => {
  // Substring matching on "step" would catch these; word matching does not.
  assert.equal(isStepGoal('Stepping up my running', 5000), false);
  assert.equal(isStepGoal('Have stepped back from work', 2000), false);
});

test('an empty or nonsense title is not a step goal', () => {
  assert.equal(isStepGoal('', 8000), false);
  assert.equal(isStepGoal('   ', 8000), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './stepGoal.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/stepGoal.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 8 new tests, 62 total, `# fail 0`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/stepGoal.ts src/lib/stepGoal.test.ts`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/lib/stepGoal.ts src/lib/stepGoal.test.ts
git commit -m "Add isStepGoal, guarded so a business plan is not logged from a pedometer"
```

---

### Task 2: The device's connect/decline decision

**Files:**
- Create: `src/state/useHealthSyncStore.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type HealthSyncDecision = 'connected' | 'declined' | null`; `useHealthSyncStore` with `{ decision: HealthSyncDecision; hasHydrated: boolean; setDecision: (d: HealthSyncDecision) => void }`

- [ ] **Step 1: Write the store**

Create `src/state/useHealthSyncStore.ts`, following `src/state/useThemeStore.ts`'s persist pattern exactly:

```ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// null = never asked, which is what makes onboarding show the step exactly
// once. Same "never chose" marker the theme columns use.
export type HealthSyncDecision = 'connected' | 'declined' | null;

interface HealthSyncState {
  decision: HealthSyncDecision;
  // Onboarding waits for this before deciding whether to show the health
  // step, or a returning user would be asked again on every cold start
  // during the moment before AsyncStorage resolves.
  hasHydrated: boolean;
  setDecision: (decision: HealthSyncDecision) => void;
}

// Device-local rather than a profile column, unlike theme: Health Connect
// exists on one phone, and the same account on a second phone has a
// genuinely different answer. Syncing this across devices would be wrong.
export const useHealthSyncStore = create<HealthSyncState>()(
  persist(
    (set) => ({
      decision: null,
      hasHydrated: false,
      setDecision: (decision) => set({ decision }),
    }),
    {
      name: 'kinly-health-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ decision: state.decision }),
      onRehydrateStorage: () => () => {
        useHealthSyncStore.setState({ hasHydrated: true });
      },
    },
  ),
);
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/state/useHealthSyncStore.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/state/useHealthSyncStore.ts
git commit -m "Add the device-local health sync decision store"
```

---

### Task 3: `useSetGoalSource` — changing a goal's source

Needed by both the Auto badge's undo and Task 4's convert-on-connect pass. `useUpdateGoal` only writes `title` and `target`, so it cannot do this.

**Files:**
- Modify: `src/hooks/useGoals.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `useSetGoalSource()` returning a mutation taking `{ goalId: string; circleId: string; source: GoalSource }`

- [ ] **Step 1: Add the mutation**

In `src/hooks/useGoals.ts`, directly after `useUpdateGoal`, add:

```ts
// Changes only goal_source. Separate from useUpdateGoal, which writes title
// and target and would need both to change one field. Used by the Auto
// badge's undo and by the convert-on-connect pass in useHealthSync.
export function useSetGoalSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      circleId,
      source,
    }: {
      goalId: string;
      circleId: string;
      source: GoalSource;
    }) => {
      const { error } = await supabase.from('goals').update({ goal_source: source }).eq('id', goalId);
      if (error) throw error;
      return { circleId };
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}
```

Add `GoalSource` to that file's type import from `../types/models` if it is not already imported — check the existing import line first.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useGoals.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoals.ts
git commit -m "Add useSetGoalSource for changing a goal between manual and steps"
```

---

### Task 4: `useHealthSync` — the one write path

**Files:**
- Create: `src/hooks/useHealthSync.ts`

**Interfaces:**
- Consumes: `useHealthSyncStore` (Task 2), `useSetGoalSource` (Task 3), `isStepGoal` (Task 1), and `getHealthConnectStatus` / `requestStepsReadPermission` / `openHealthConnectSettings` from `src/lib/healthConnect`
- Produces: `useHealthSync(circleId?: string)` returning `{ status: HealthConnectStatus | 'checking'; decision: HealthSyncDecision; isConnected: boolean; permissionDenied: boolean; isBusy: boolean; connect: () => Promise<boolean>; decline: () => void; disconnect: () => void; openSettings: () => Promise<void> }`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useHealthSync.ts`:

```tsx
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getHealthConnectStatus,
  openHealthConnectSettings,
  requestStepsReadPermission,
  type HealthConnectStatus,
} from '../lib/healthConnect';
import { useGoals, useSetGoalSource } from './useGoals';
import { useHealthSyncStore, type HealthSyncDecision } from '../state/useHealthSyncStore';
import { isStepGoal } from '../lib/stepGoal';
import { useAuthStore } from '../state/useAuthStore';

// The single write path for the health-sync connection, used by onboarding
// and Profile settings alike - the same shape as themePrefs.ts, which is the
// established pattern for "one place that changes a preference".
//
// Permission is requested here and nowhere else. It used to be requested
// from inside useSyncStepGoals' effect, which made Android's health dialog
// appear when the user opened the Goals tab, unprompted and unexplained.
export function useHealthSync(circleId?: string) {
  const decision = useHealthSyncStore((state) => state.decision);
  const setDecision = useHealthSyncStore((state) => state.setDecision);
  const userId = useAuthStore((state) => state.user?.id);
  const { data: goals } = useGoals(circleId);
  const setGoalSource = useSetGoalSource();
  const [isBusy, setIsBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Cached rather than re-read on every render: getSdkStatus touches the
  // native module, and the answer only changes if the user installs Health
  // Connect while the app is running.
  const { data: status = 'checking' } = useQuery({
    queryKey: ['healthConnectStatus'],
    queryFn: getHealthConnectStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Both conditions matter: a device that connected and later had Health
  // Connect uninstalled reports 'connected' but cannot sync, and a switch
  // showing on while nothing happens is worse than one showing off.
  const isConnected = decision === 'connected' && status === 'available';

  const connect = useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    setPermissionDenied(false);
    try {
      const granted = await requestStepsReadPermission();
      if (!granted) {
        setPermissionDenied(true);
        return false;
      }
      setDecision('connected');

      // Detection at creation time alone would break the promise for the
      // commonest case: someone creates "Walk 8,000 steps daily" on day one,
      // finds this a week later, connects - and that goal still needs
      // logging by hand because it was created 'manual'. One pass over what
      // they already have fixes that. Runs on connect only, never on start.
      if (circleId && userId) {
        const convertible = (goals ?? []).filter(
          (goal) =>
            goal.user_id === userId &&
            goal.goal_source === 'manual' &&
            isStepGoal(goal.title, goal.target),
        );
        for (const goal of convertible) {
          await setGoalSource.mutateAsync({ goalId: goal.id, circleId, source: 'health_steps' });
        }
      }
      return true;
    } finally {
      setIsBusy(false);
    }
  }, [circleId, userId, goals, setDecision, setGoalSource]);

  // Deliberately does NOT convert goals back to 'manual'. That would rewrite
  // the user's data in response to a permission change, and would discard
  // any per-goal undos they had already made. The sync hook is gated on the
  // connection, so those goals simply stop updating until they reconnect.
  const disconnect = useCallback(() => {
    setDecision('declined');
    setPermissionDenied(false);
  }, [setDecision]);

  const decline = useCallback(() => setDecision('declined'), [setDecision]);

  return {
    status: status as HealthConnectStatus | 'checking',
    decision: decision as HealthSyncDecision,
    isConnected,
    permissionDenied,
    isBusy,
    connect,
    decline,
    disconnect,
    openSettings: openHealthConnectSettings,
  };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useHealthSync.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useHealthSync.ts
git commit -m "Add useHealthSync, the one place the connection changes"
```

---

### Task 5: `HealthSyncRow` in Profile settings

**Files:**
- Create: `src/components/HealthSyncRow.tsx`
- Modify: `src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useHealthSync(circleId)` (Task 4), `ToggleSwitch` from `src/components/ToggleSwitch`
- Produces: `<HealthSyncRow />`

- [ ] **Step 1: Write the component**

Create `src/components/HealthSyncRow.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ToggleSwitch } from './ToggleSwitch';
import { AnimatedPressable } from './AnimatedPressable';
import { useHealthSync } from '../hooks/useHealthSync';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Always reflects real state, so "why aren't my steps syncing?" is answered
// on screen rather than guessed at. Android's permission denial is otherwise
// indistinguishable from nothing happening - the exact failure
// MOBILE_APP_LEARNINGS.md's UI-states checklist calls out.
export function HealthSyncRow() {
  const circleId = useAuthStore((state) => state.activeCircleId);
  const { status, isConnected, permissionDenied, isBusy, connect, disconnect, openSettings } =
    useHealthSync(circleId ?? undefined);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // iOS and Android-without-Health-Connect get nothing at all - a row
  // explaining a feature the device cannot have is just noise.
  if (status === 'checking' || status === 'unavailable') return null;

  let hint = 'Log walking goals automatically';
  if (isConnected) hint = "Reads today's step count from Health Connect";
  else if (status === 'needs-install') hint = "Health Connect isn't installed on this phone";
  else if (permissionDenied) hint = "Kinly doesn't have permission to read steps";

  const needsSettings = status === 'needs-install' || permissionDenied;

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.label}>Sync steps</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {needsSettings ? (
        <AnimatedPressable style={styles.fix} onPress={openSettings} accessibilityRole="button">
          <Text style={styles.fixText}>{status === 'needs-install' ? 'Install' : 'Fix in Settings'}</Text>
        </AnimatedPressable>
      ) : (
        <ToggleSwitch
          value={isConnected}
          onValueChange={(next) => {
            if (isBusy) return;
            if (next) void connect();
            else disconnect();
          }}
        />
      )}
    </View>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
    },
    copy: { flex: 1, gap: 2 },
    label: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    hint: { fontSize: 13, color: colors.textSecondary },
    fix: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    fixText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  });
}
```

- [ ] **Step 2: Mount it in Profile**

In `src/screens/ProfileScreen.tsx`, add the import:

```tsx
import { HealthSyncRow } from '../components/HealthSyncRow';
```

Then render `<HealthSyncRow />` directly above the existing `<ThemePicker ... />` element, so device preferences sit together.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/components/HealthSyncRow.tsx src/screens/ProfileScreen.tsx`
Expected: 62 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git add src/components/HealthSyncRow.tsx src/screens/ProfileScreen.tsx
git commit -m "Add the health sync row to Profile, with a state for every reason it can fail"
```

---

### Task 6: The onboarding step

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `useHealthSync` (Task 4), `useHealthSyncStore` (Task 2)

- [ ] **Step 1: Add the imports**

In `src/screens/OnboardingScreen.tsx`:

```tsx
import { useHealthSync } from '../hooks/useHealthSync';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
```

- [ ] **Step 2: Write the step component**

Add this function directly above `function CircleStep() {`:

```tsx
// Offered only where it can actually work - Android with Health Connect
// present - and only once. "Not now" is remembered, so a user who declines
// is never asked again on this device; Profile is where they change their
// mind.
function HealthStep() {
  const { connect, decline, isBusy } = useHealthSync();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Count your steps for you?</Text>
      <Text style={styles.cardBody}>
        Kinly can read your daily step count from Health Connect, so walking goals log themselves.
      </Text>
      <PillButton label="Connect" onPress={() => void connect()} loading={isBusy} />
      <PillButton label="Not now" variant="outline" onPress={decline} style={{ marginTop: 10 }} />
    </View>
  );
}
```

Check `createStyles` in this file for the actual names of its card/title/body styles before using `card` / `cardTitle` / `cardBody` — reuse whatever `ThemeStep` and `CircleStep` already use rather than adding new styles. `PillButton` is already imported in this file; confirm before adding the import.

- [ ] **Step 3: Gate and render the step**

In `OnboardingScreen`, after the existing `needsTheme` line, add:

```tsx
  // Only where it can work, and only once. hasHydrated matters: without it
  // a returning user who already declined would be asked again during the
  // moment before AsyncStorage resolves.
  const healthDecision = useHealthSyncStore((state) => state.decision);
  const healthHydrated = useHealthSyncStore((state) => state.hasHydrated);
  const { status: healthStatus } = useHealthSync();
  const needsHealth =
    !!user &&
    !needsInterests &&
    !needsTheme &&
    healthHydrated &&
    healthDecision === null &&
    healthStatus === 'available';
```

Then replace the step-dots and step-body lines with exactly:

```tsx
            {user && (
              <StepDots
                step={needsInterests ? 1 : needsTheme ? 2 : 3}
                total={needsHealth ? 4 : 3}
              />
            )}
            {!user ? (
              <AuthStep />
            ) : needsInterests ? (
              <InterestsStep />
            ) : needsTheme ? (
              <ThemeStep />
            ) : needsHealth ? (
              <HealthStep />
            ) : (
              <CircleStep />
            )}
```

The health step is 3 of 4 when it shows; when it does not, the circle step is 3 of 3. Both are `step={... : 3}`, which is why one expression covers them.

- [ ] **Step 4: Add the subtitle**

In the `subtitle` chain, between the theme line and the final `else if (user)` line:

```tsx
  else if (user && needsHealth) subtitle = 'One less thing to remember. Optional, and changeable in Profile.';
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/screens/OnboardingScreen.tsx`
Expected: 62 passing, then no output from either

- [ ] **Step 6: Commit**

```bash
git add src/screens/OnboardingScreen.tsx
git commit -m "Offer step sync during onboarding, once, only where it works"
```

---

### Task 7: Auto-detect on create, and delete the old toggle

**Files:**
- Modify: `src/hooks/useGoals.ts`
- Modify: `src/screens/GoalsScreen.tsx`

**Interfaces:**
- Consumes: `isStepGoal` (Task 1), `useHealthSyncStore` (Task 2)

- [ ] **Step 1: Detect at creation**

In `src/hooks/useGoals.ts`, add the imports:

```ts
import { isStepGoal } from '../lib/stepGoal';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
```

In `useCreateGoal`'s `mutationFn`, replace:

```ts
          goal_source: source ?? 'manual',
```

with:

```ts
          goal_source: resolveGoalSource(source, title, target),
```

And add this helper directly above `useCreateGoal`:

```ts
// An explicit `source` from the caller always wins; otherwise a connected
// device auto-detects. On a device that never connected every goal is
// 'manual', so nothing is ever marked for a sync that cannot happen.
function resolveGoalSource(
  source: GoalSource | undefined,
  title: string,
  target: number,
): GoalSource {
  if (source) return source;
  const connected = useHealthSyncStore.getState().decision === 'connected';
  return connected && isStepGoal(title, target) ? 'health_steps' : 'manual';
}
```

Note this reads the store via `getState()` rather than the hook, because it runs inside a mutation callback rather than during render.

- [ ] **Step 2: Delete the add-goal toggle**

In `src/screens/GoalsScreen.tsx`, remove this whole block:

```tsx
      {Platform.OS === 'android' && (
        <View style={styles.stepsToggleRow}>
          <ToggleSwitch value={trackSteps} onValueChange={setTrackSteps} />
          <Text style={styles.stepsToggleLabel}>Track automatically with Health Connect (steps)</Text>
        </View>
      )}
```

Then remove the `const [trackSteps, setTrackSteps] = useState(false);` line, the `source: trackSteps ? 'health_steps' : 'manual',` property from the `createGoal.mutateAsync` call (so no `source` is passed at all, letting detection run), and the `setTrackSteps(false);` reset line.

Delete the `stepsToggleRow` and `stepsToggleLabel` styles. Run `npx eslint src/screens/GoalsScreen.tsx` to find any now-unused imports (`Platform` and `ToggleSwitch` may still be used elsewhere in the file — let eslint decide rather than removing them blind).

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/hooks/useGoals.ts src/screens/GoalsScreen.tsx`
Expected: 62 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGoals.ts src/screens/GoalsScreen.tsx
git commit -m "Detect step goals on create and delete the per-goal toggle"
```

---

### Task 8: The Auto badge and its undo

**Files:**
- Modify: `src/screens/GoalsScreen.tsx`

**Interfaces:**
- Consumes: `useSetGoalSource` (Task 3), `useHealthSync` (Task 4)

- [ ] **Step 1: Render the badge**

In `src/screens/GoalsScreen.tsx`'s `GoalCard`, add near the other hooks:

```tsx
  const setGoalSource = useSetGoalSource();
  const { isConnected } = useHealthSync(circleId);
```

`isStepGoal` already exists in that component as `const isStepGoal = goal.goal_source === 'health_steps';`. Directly below the goal's progress bar, add:

```tsx
      {/* Only while connected: a health_steps goal on a disconnected device
          is not being auto-tracked, so calling it "Auto" would be a lie. */}
      {isStepGoal && isConnected && (
        <View style={styles.autoBadge}>
          <Text style={styles.autoBadgeText}>Auto · Health Connect</Text>
          <AnimatedPressable
            onPress={() =>
              setGoalSource.mutate({ goalId: goal.id, circleId, source: 'manual' })
            }
            accessibilityRole="button"
            accessibilityLabel="Stop tracking this goal from Health Connect"
            style={styles.autoBadgeUndo}
          >
            <Text style={styles.autoBadgeUndoText}>✕</Text>
          </AnimatedPressable>
        </View>
      )}
```

- [ ] **Step 2: Add the styles**

In `GoalsScreen`'s `createStyles`:

```tsx
    autoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginTop: 8,
      paddingLeft: 10,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceSubtle,
    },
    autoBadgeText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    autoBadgeUndo: { minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
    autoBadgeUndoText: { fontSize: 13, color: colors.textSecondary },
```

Confirm `radii` is destructured in that `createStyles` signature; add it if not.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/screens/GoalsScreen.tsx`
Expected: 62 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git add src/screens/GoalsScreen.tsx
git commit -m "Show which goals are auto-tracked, and let one tap undo it"
```

---

### Task 9: Sync once per app foreground, app-wide

**Files:**
- Modify: `src/hooks/useSyncStepGoals.ts`
- Modify: `src/navigation/MainTabs.tsx`
- Modify: `src/screens/GoalsScreen.tsx`

**Interfaces:**
- Consumes: `useHealthSyncStore` (Task 2)

- [ ] **Step 1: Make the hook foreground-driven and gated**

In `src/hooks/useSyncStepGoals.ts`, add the imports:

```ts
import { AppState } from 'react-native';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
```

Replace the `useEffect(...)` block's dependency-driven trigger with a foreground-driven one. The whole effect becomes:

```ts
  const isConnected = useHealthSyncStore((state) => state.decision === 'connected');

  useEffect(() => {
    // Gated on the connection: an unconnected device never touches the
    // native module at all. Permission is NOT requested here - that happens
    // only when the user taps Connect (useHealthSync), because a health
    // dialog appearing from a background sync is indistinguishable from a bug.
    if (!circleId || !userId || !isConnected || stepGoals.length === 0) return;
    let cancelled = false;

    async function sync() {
      const status = await getHealthConnectStatus();
      if (status !== 'available' || cancelled) return;
      const steps = await readTodaysSteps();
      if (cancelled) return;

      for (const goal of stepGoals) {
        const wasComplete = goal.progress >= goal.target;
        const previousStreak = goal.streak_count;
        const updated = await syncStepGoal.mutateAsync({ goalId: goal.id, circleId, steps });
        if (cancelled) return;

        const justCompleted = !wasComplete && updated.progress >= updated.target;
        const hitMilestone =
          updated.streak_count > previousStreak && STREAK_MILESTONES.includes(updated.streak_count);
        if (!justCompleted && !hitMilestone) continue;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (justCompleted) {
          await logEvent.mutateAsync({ circleId, userId, type: 'goal_completed', payload: { title: goal.title } });
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'goal_completed',
            title: `Completed "${goal.title}"`,
          });
          setCelebration({ title: `Completed "${goal.title}"! 🎉` });
        } else {
          await logEvent.mutateAsync({
            circleId,
            userId,
            type: 'streak',
            payload: { title: goal.title, streak_count: updated.streak_count },
          });
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'streak',
            title: `${updated.streak_count}-day streak on "${goal.title}"`,
          });
          setCelebration({ title: `${updated.streak_count}-day streak!`, subtitle: goal.title });
        }
      }
    }

    // Once on mount, then once per return to the foreground - rather than on
    // every focus of one screen, which left the garden and Home's mission
    // list stale until the user happened to open Goals.
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, userId, isConnected, stepGoalsKey]);
```

Remove `getHealthConnectStatus`'s sibling import of `requestStepsReadPermission` from this file — it is no longer called here, and that removal is the point of the task. Keep `getHealthConnectStatus` and `readTodaysSteps`.

- [ ] **Step 2: Move the call site to the navigator**

In `src/screens/GoalsScreen.tsx`, delete the `useSyncStepGoals(...)` call, the `stepCelebration` / `dismissCelebration` bindings, the `{stepCelebration && (<MilestoneCardModal ... />)}` block, and the `useSyncStepGoals` import.

In `src/navigation/MainTabs.tsx`, add:

```tsx
import { useGoals } from '../hooks/useGoals';
import { useSyncStepGoals } from '../hooks/useSyncStepGoals';
import { MilestoneCardModal } from '../components/MilestoneCardModal';
```

Inside `MainTabs`, alongside the existing `circleId` / `userId` bindings:

```tsx
  const { data: goals } = useGoals(circleId ?? undefined);
  // Lives here rather than on the Goals screen so a step goal's progress -
  // and the garden, mission list and member rows derived from it - is
  // current whichever tab the app opens on.
  const { celebration: stepCelebration, dismissCelebration } = useSyncStepGoals(
    circleId ?? undefined,
    userId,
    goals,
  );
```

Then wrap the returned `<Tab.Navigator>` in a fragment so the modal can sit beside it:

```tsx
  return (
    <>
      <Tab.Navigator ...>
        ...
      </Tab.Navigator>
      {stepCelebration && (
        <MilestoneCardModal
          title={stepCelebration.title}
          subtitle={stepCelebration.subtitle}
          onClose={dismissCelebration}
        />
      )}
    </>
  );
```

- [ ] **Step 3: Verify the permission request is gone from the sync path**

Run: `grep -rn "requestStepsReadPermission" src/`
Expected: exactly two hits — the definition in `src/lib/healthConnect.ts` and the single call in `src/hooks/useHealthSync.ts`. A hit in `useSyncStepGoals.ts` means Step 1 is incomplete.

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/`
Expected: 62 passing, then no output from either

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSyncStepGoals.ts src/navigation/MainTabs.tsx src/screens/GoalsScreen.tsx
git commit -m "Sync steps once per foreground, app-wide, only when connected"
```

---

### Task 10: Verify and document

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run everything**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# pass 62`, `# fail 0`, then no output from either.

- [ ] **Step 2: Verify nothing imports the native module directly**

Run: `grep -rn "react-native-health-connect" src/`
Expected: exactly one hit, the lazy `import()` inside `src/lib/healthConnect.ts`. Any other hit would break iOS.

- [ ] **Step 3: Verify on an Android device**

This feature cannot be verified on iOS or in a simulator without Health Connect. On a real Android phone with Health Connect installed and some step data:

1. Fresh install → onboarding offers **Count your steps for you?** after the theme step, with 4 dots.
2. Tap **Connect** → Android's permission dialog appears *immediately*, not later and not on another screen.
3. Grant it → onboarding continues to the circle step.
4. Create a goal titled "Walk 8,000 steps daily" with target 8000 → it shows **Auto · Health Connect**.
5. Create a goal titled "Steps to launch my business" with target 5 → it does **not**.
6. Background the app, walk, foreground it on the **Today** tab → the garden and mission list already reflect the new steps, without visiting Goals.
7. Tap the badge's ✕ → the goal stops auto-tracking and the badge disappears.
8. Profile → **Sync steps** switch is on; turn it off → badges disappear and syncing stops.
9. Revoke Kinly's Health Connect permission in Android settings, reopen → Profile row reads "Kinly doesn't have permission to read steps" with **Fix in Settings**.
10. On an iPhone, or an Android phone without Health Connect: no onboarding step, no Profile row, no badges.

- [ ] **Step 4: Document it**

Add to `ARCHITECTURE.md`, after the "Home and Circle split" bullet:

```markdown
- **Health Connect step sync** (docs/superpowers/specs/2026-08-01-health-step-sync-design.md): one device-level connection replaces the per-goal toggle that used to sit in the add-goal form. It is offered once in onboarding — only on Android *and* only when `getHealthConnectStatus()` reports `available` — and lives in Profile as `HealthSyncRow` ([src/components/HealthSyncRow.tsx](src/components/HealthSyncRow.tsx)), which renders a distinct state for connected, available-but-off, Health Connect not installed, and permission denied, because Android's denial is otherwise indistinguishable from nothing happening. `useHealthSync` ([src/hooks/useHealthSync.ts](src/hooks/useHealthSync.ts)) is the single write path and **the only place permission is requested** — it used to be requested from inside `useSyncStepGoals`' effect, so the health dialog appeared when a user opened the Goals tab, unprompted. Connecting also runs a one-off pass converting existing matching goals, because detection at creation time alone would leave a walking goal created before connecting stuck on manual forever; disconnecting deliberately does not convert back, since that would rewrite data in response to a permission change and discard per-goal undos. `isStepGoal` ([src/lib/stepGoal.ts](src/lib/stepGoal.ts)) requires both a word-boundary "steps" match *and* a target ≥ 1000 — the guard is what stops "Steps to launch my business" logging itself from a pedometer — and `GoalsScreen`'s `Auto · Health Connect` badge is the one-tap undo for what it still gets wrong. The badge renders only while connected, since a `health_steps` goal on a disconnected device is not being tracked. `useSyncStepGoals` fires once per app foreground from `MainTabs` rather than on Goals-screen focus, so the garden, Home's mission list and the Circle tab's member rows are all current whichever tab the app opens on. The decision is device-local (`useHealthSyncStore`, AsyncStorage) rather than a profile column, unlike theme: Health Connect exists on one phone, and the same account on another phone has a genuinely different answer. iOS is untouched throughout — `healthConnect.ts` lazily imports the native module and returns inert values off Android.
```

- [ ] **Step 5: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "Document Health Connect step sync"
```

---

## What this plan deliberately does not do

- **iOS / HealthKit.** A separate integration with a different permission model. Half-building it now would be worse than not starting.
- **Background sync.** Steps landing without the app being opened would need a background-task native module, a new build, and battery/OS-throttling handling — bigger than the rest of this feature combined.
- **Health data beyond steps.** Sleep, heart rate and workouts are each their own permission and their own "what does the circle see" privacy decision.
- **Showing raw step counts to the circle.** Members see goal progress, exactly as they do for manual goals.
