# Areas of Growth — Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Areas of Growth model live end-to-end for a single member — set a goal in an Area with a cadence, check in against it, and see a real streak.

**Architecture:** A pure `cadence.ts` module owns all cadence display and validation, unit-tested like `showingUp.ts`. Three hooks wrap the tables the write path needs (`useAreas`, `useGoalCheckins`, plus a rewritten `useGoals`). `GoalsScreen` is rebuilt around them: the numeric target field is deleted, and a check-in tap writes one `goal_checkins` row instead of mutating `goals.progress`.

**Tech Stack:** Expo 54 / React Native 0.81, TanStack Query v5, Supabase JS v2, Zustand, TypeScript 5.9, `node --experimental-strip-types --test`.

## What Plan 1 already built (do not rebuild)

- `src/lib/periods.ts` — `WEEK_STARTS_ON`, `toLocalDate`, `toIsoDate`, `isoWeekday`, `addDays`, `startOfWeek`, `startOfMonth`, `daysRemainingInWeek`, `daysRemainingInMonth`
- `src/lib/showingUp.ts` — `TargetType`, `Cadence`, `CheckinDates`, `isShowingUp(cadence, checkins, now)`, `streak(...)`, `consistency(...) → { done, of }`
- `src/lib/circleRollup.ts` — `areaRollup(...)`, `circleActivityStreak(...)`
- Migrations 0046/0047/0048, **already applied to the live database**: tables `areas` (8 seeded), `circle_areas`, `goal_checkins`, `goal_history`; `goals` gained `area_id`, `target_type`, `target_count`, `target_weekdays`, `status`, `started_at`, `ended_at`, `ended_reason`, `kind`.
- Types in `src/types/models.ts` — `Area`, `AreaKey`, `CircleArea`, `GoalCheckin`, `GoalHistoryEntry`, `GoalStatus`, `EndedReason`, `GoalKind`, and the extended `Goal`.

176 tests pass at the start of this plan.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-areas-of-growth-design.md`.
- **Expo is 54** (`package.json` pins `^54.0.36`), not the v57 in `AGENTS.md`. Build against 54.
- **Never write the phrase "on track"** in any identifier, comment, or user-visible string. The primitive is *showing up*.
- **`goal_checkins` has no UPDATE policy, deliberately.** A supabase-js `.upsert()` takes the `ON CONFLICT DO UPDATE` path and **will be rejected by RLS with error 42501**. Note that `ignoreDuplicates` is an option on `.upsert()` only — the installed `@supabase/supabase-js` 2.110.8 does not accept it on `.insert()` (whose only options are `count` and `defaultToNull`). Check-ins are therefore written with a plain `.insert()`, swallowing Postgres error **23505** (`unique_violation` on `(goal_id, checkin_date)`) as the harmless repeat-tap no-op. Same idempotency, no UPDATE policy required.
- **RLS enforces `checkin_date <= current_date`.** Do not offer backdating; a future date is rejected by the database.
- **Every goal created must carry a `target_type`.** The column is nullable with no default, and a NULL cadence makes `isShowingUp` return false forever.
- **Do NOT add `.eq('status', 'active')` to any existing query in this plan.** Migration 0047 set `status = 'ended'` on every goal whose `category` was NULL or `misc`. Nothing filters on `status` today, so those goals still render. Adding the filter makes a large slice of every circle's goals vanish in one release. Task 9 handles this deliberately and is the only place it changes.
- **One active goal per (circle_id, user_id, area_id)** is enforced by the partial unique index `goals_one_active_per_area` (created at the end of migration 0047). Violating it raises Postgres error **23505**, which must be surfaced as readable copy, never a raw error string.
- **`consistency()` can return `{ done: 0, of: 0 }`** for an unrecognised cadence. Any renderer computing a percentage must guard `of === 0` or it prints `NaN`.
- **No raw hex in components.** Colour comes from `useTheme()`; spacing and type from `src/theme/colors`. Follow `AppTextInput.tsx` for the house component shape.
- **Never `Alert.alert` for anything with more than two buttons.** Android keeps only `buttons.slice(0, 3)` and hardcodes `cancelable: false`. Use `src/components/ActionSheet.tsx`.
- Tests: `npm test`. Typecheck: `npx tsc --noEmit`. Lint: `npx eslint <paths>`.
- Commit after every task.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/cadence.ts` (create) | Pure cadence display + validation. No React, no Supabase. |
| `src/lib/cadence.test.ts` (create) | Unit tests for the above. |
| `src/hooks/useAreas.ts` (create) | Read the Area catalog and a circle's enabled Areas. |
| `src/hooks/useCheckins.ts` (create) | Read a circle's check-ins; write and undo one. |
| `src/hooks/useGoals.ts` (modify) | Create/replace/finish/delete with Areas, cadence and archiving. |
| `src/components/AreaPicker.tsx` (create) | Choose among a circle's enabled Areas. |
| `src/components/CadencePicker.tsx` (create) | Choose `target_type` and its parameters. |
| `src/components/GoalCadenceRow.tsx` (create) | Render one goal's cadence, streak and consistency. |
| `src/screens/GoalsScreen.tsx` (modify) | Rebuild the add form and the goal card around the above. |

Tasks 1–5 are logic and hooks. Tasks 6–10 are UI.

---

### Task 1: Cadence display and validation

**Files:**
- Create: `src/lib/cadence.ts`
- Test: `src/lib/cadence.test.ts`

**Interfaces:**
- Consumes: `TargetType`, `Cadence` from `src/lib/showingUp.ts`.
- Produces: `WEEKDAY_LABELS`, `describeCadence(cadence): string`, `validateCadence(draft): string | null`, `type CadenceDraft`. Tasks 4, 6, 7 and 9 all use these.

`describeCadence` is the single source of cadence copy — "Every day", "4× a week", "Mon · Wed · Fri", "2× a month". Without one owner, the add form, the goal card and the Area detail screen each invent their own wording.

- [ ] **Step 1: Write the failing test**

Create `src/lib/cadence.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCadence, validateCadence, WEEKDAY_LABELS } from './cadence.ts';

test('weekday labels are Monday-first, matching WEEK_STARTS_ON', () => {
  assert.deepEqual(WEEKDAY_LABELS, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('describeCadence renders each cadence in its own words', () => {
  assert.equal(
    describeCadence({ target_type: 'daily', target_count: null, target_weekdays: null }),
    'Every day',
  );
  assert.equal(
    describeCadence({ target_type: 'times_per_week', target_count: 4, target_weekdays: null }),
    '4× a week',
  );
  assert.equal(
    describeCadence({ target_type: 'times_per_week', target_count: 1, target_weekdays: null }),
    'Once a week',
  );
  assert.equal(
    describeCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [1, 3, 5] }),
    'Mon · Wed · Fri',
  );
  assert.equal(
    describeCadence({ target_type: 'monthly', target_count: 1, target_weekdays: null }),
    'Once a month',
  );
  assert.equal(
    describeCadence({ target_type: 'monthly', target_count: 3, target_weekdays: null }),
    '3× a month',
  );
});

test('describeCadence renders weekdays in Monday-first order regardless of input order', () => {
  assert.equal(
    describeCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [5, 1, 3] }),
    'Mon · Wed · Fri',
  );
});

test('describeCadence never returns an empty string for a goal with no cadence', () => {
  // Every goal the current app created before this plan has target_type null.
  assert.equal(
    describeCadence({ target_type: null, target_count: null, target_weekdays: null }),
    'No cadence set',
  );
});

test('validateCadence accepts well-formed drafts', () => {
  assert.equal(validateCadence({ target_type: 'daily', target_count: null, target_weekdays: null }), null);
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 4, target_weekdays: null }),
    null,
  );
  assert.equal(
    validateCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [1] }),
    null,
  );
  assert.equal(validateCadence({ target_type: 'monthly', target_count: 1, target_weekdays: null }), null);
});

test('validateCadence rejects a count the database would refuse', () => {
  // goals_target_count_positive: check (target_count is null or target_count > 0)
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 0, target_weekdays: null }),
    'Pick how many times a week.',
  );
  assert.equal(
    validateCadence({ target_type: 'monthly', target_count: 0, target_weekdays: null }),
    'Pick how many times a month.',
  );
});

test('validateCadence rejects more than seven times a week', () => {
  assert.equal(
    validateCadence({ target_type: 'times_per_week', target_count: 8, target_weekdays: null }),
    'A week only has seven days.',
  );
});

test('validateCadence rejects an empty weekday set', () => {
  assert.equal(
    validateCadence({ target_type: 'specific_weekdays', target_count: null, target_weekdays: [] }),
    'Pick at least one day.',
  );
});

test('validateCadence rejects a missing cadence', () => {
  assert.equal(
    validateCadence({ target_type: null, target_count: null, target_weekdays: null }),
    'Pick how often.',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './cadence.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/cadence.ts`:

```ts
// How a cadence is worded, and whether a draft one is legal.
//
// One owner for this copy on purpose: the add form, the goal card and the
// Area detail grid all render the same cadence, and three hand-written
// versions drift into "4x/week", "4 times a week" and "4× a week" on three
// screens of the same app.
//
// Dependency-free apart from showingUp.ts so node:test can import it under
// --experimental-strip-types.

import type { Cadence, TargetType } from './showingUp.ts';

// Monday-first, matching WEEK_STARTS_ON in periods.ts. Index i is ISO
// weekday i + 1.
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// A cadence being built in the UI, before it is known to be valid. Mirrors
// Cadence but with target_type nullable, because "nothing picked yet" is the
// starting state of the form.
export interface CadenceDraft {
  target_type: TargetType | null;
  target_count: number | null;
  target_weekdays: number[] | null;
}

export function describeCadence(cadence: Cadence | CadenceDraft): string {
  switch (cadence.target_type) {
    case 'daily':
      return 'Every day';
    case 'times_per_week': {
      const n = cadence.target_count ?? 0;
      return n === 1 ? 'Once a week' : `${n}× a week`;
    }
    case 'specific_weekdays': {
      const days = [...(cadence.target_weekdays ?? [])].sort((a, b) => a - b);
      return days.map((d) => WEEKDAY_LABELS[d - 1]).join(' · ');
    }
    case 'monthly': {
      const n = cadence.target_count ?? 1;
      return n === 1 ? 'Once a month' : `${n}× a month`;
    }
    default:
      // Every goal created before this plan has a null target_type. They are
      // still on screen, so this needs real copy rather than an empty string
      // that renders as a blank line under the title.
      return 'No cadence set';
  }
}

// Returns an error message to show the user, or null if the draft is legal.
// Message strings, not booleans, so the form has something to display and
// the reason lives next to the rule.
export function validateCadence(draft: CadenceDraft): string | null {
  switch (draft.target_type) {
    case 'daily':
      return null;
    case 'times_per_week':
      // The database refuses 0 or less (goals_target_count_positive), and a
      // week cannot hold more than seven.
      if (!draft.target_count || draft.target_count < 1) return 'Pick how many times a week.';
      if (draft.target_count > 7) return 'A week only has seven days.';
      return null;
    case 'specific_weekdays':
      if (!draft.target_weekdays || draft.target_weekdays.length === 0) return 'Pick at least one day.';
      return null;
    case 'monthly':
      if (!draft.target_count || draft.target_count < 1) return 'Pick how many times a month.';
      return null;
    default:
      return 'Pick how often.';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 187 tests (176 + 11 new).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/lib/cadence.ts
git add src/lib/cadence.ts src/lib/cadence.test.ts
git commit -m "Give cadence one owner for its wording and its rules"
```

---

### Task 2: Area hooks

**Files:**
- Create: `src/hooks/useAreas.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase`, `Area` and `CircleArea` from `src/types/models`.
- Produces: `useAreas()` returning `UseQueryResult<Area[]>`, `useCircleAreas(circleId)` returning `UseQueryResult<Area[]>` (the *enabled* Areas for that circle, already joined and sorted). Tasks 6, 8 and 9 consume these.

`useCircleAreas` returns `Area[]`, not `CircleArea[]`, because every caller wants the label and emoji to render. Returning join rows would make each caller re-join against `useAreas`.

- [ ] **Step 1: Write the hook**

There is no unit test for this task: it is a thin Supabase query wrapper, matching the untested shape of every other hook in `src/hooks/`. It is verified by typecheck and by Task 8 rendering it.

Create `src/hooks/useAreas.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Area } from '../types/models';

// The Area catalog is seeded by migration 0046 and has no write policy at
// all - members cannot create Areas, and that is enforced by the database
// rather than only by the absence of a button. It changes only when a
// migration changes it, so it is cached hard.
export function useAreas() {
  return useQuery({
    queryKey: ['areas'],
    staleTime: Infinity,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase.from('areas').select('*').order('sort_order');
      if (error) throw error;
      return data as Area[];
    },
  });
}

// The Areas a circle has switched on, as full Area rows ready to render.
// Returning join rows instead would make every caller re-join against
// useAreas just to get a label and an emoji.
export function useCircleAreas(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circle-areas', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Area[]> => {
      const { data, error } = await supabase
        .from('circle_areas')
        .select('area_id, enabled, areas(*)')
        .eq('circle_id', circleId as string)
        .eq('enabled', true);
      if (error) throw error;
      const areas = (data ?? [])
        .map((row) => (row as unknown as { areas: Area }).areas)
        .filter(Boolean);
      return areas.sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Confirm the tests still pass**

Run: `npm test`
Expected: PASS, 187 tests.

- [ ] **Step 4: Commit**

```bash
npx eslint src/hooks/useAreas.ts
git add src/hooks/useAreas.ts
git commit -m "Read the Area catalog and each circle's enabled Areas"
```

---

### Task 3: The check-in ledger

**Files:**
- Create: `src/hooks/useCheckins.ts`

**Interfaces:**
- Consumes: `supabase`, `GoalCheckin` from `src/types/models`.
- Produces: `useGoalCheckins(circleId)` returning `UseQueryResult<Record<string, string[]>>` — check-in dates keyed by `goal_id`, newest first; `useCheckIn()`; `useUndoCheckIn()`. Tasks 9 and 10 consume these. The `Record<string, string[]>` shape is exactly what `isShowingUp`, `streak` and `consistency` take as their `checkins` argument.

**This is the task the whole plan exists for.** Read the two constraints below before writing code.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useCheckins.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toIsoDate } from '../lib/periods';

// Check-ins for every goal in a circle, keyed by goal_id, as plain
// YYYY-MM-DD strings - which is exactly the shape isShowingUp, streak and
// consistency take, so no caller has to reshape it.
//
// Bounded to the last 120 days. No cadence looks back further than a month,
// and streaks only need enough history to find their first gap; without a
// bound this query grows forever and is refetched on every focus.
const CHECKIN_WINDOW_DAYS = 120;

export function useGoalCheckins(circleId: string | undefined) {
  return useQuery({
    queryKey: ['goal-checkins', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const since = new Date();
      since.setDate(since.getDate() - CHECKIN_WINDOW_DAYS);

      const { data, error } = await supabase
        .from('goal_checkins')
        .select('goal_id, checkin_date, goals!inner(circle_id)')
        .eq('goals.circle_id', circleId as string)
        .gte('checkin_date', toIsoDate(since))
        .order('checkin_date', { ascending: false });
      if (error) throw error;

      const byGoal: Record<string, string[]> = {};
      for (const row of (data ?? []) as { goal_id: string; checkin_date: string }[]) {
        (byGoal[row.goal_id] ??= []).push(row.checkin_date.slice(0, 10));
      }
      return byGoal;
    },
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, userId }: { goalId: string; circleId: string; userId: string }) => {
      // .insert with ignoreDuplicates, NEVER .upsert().
      //
      // goal_checkins deliberately has no UPDATE policy (migration 0046) -
      // it is an append-only ledger. supabase-js .upsert() emits ON CONFLICT
      // DO UPDATE, which RLS rejects with 42501, so the core action of the
      // app would fail for every user on the second tap of a day.
      // ignoreDuplicates emits ON CONFLICT DO NOTHING, which needs no UPDATE
      // policy and makes a repeat tap a harmless no-op - the same property
      // the unique (goal_id, checkin_date) constraint exists to give.
      //
      // checkin_date is left to its DEFAULT current_date. RLS enforces
      // checkin_date <= current_date, so a client clock running fast would
      // have its check-in rejected outright if we sent the date ourselves.
      const { error } = await supabase
        .from('goal_checkins')
        .insert({ goal_id: goalId, user_id: userId }, { ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goal-checkins', variables.circleId] });
    },
  });
}

// Undo is a delete, which the ledger does allow (members delete their own
// rows). Mis-tapping a check-in on someone else's behalf is impossible, so
// the only person this can affect is the one who tapped.
export function useUndoCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, date }: { goalId: string; circleId: string; date: string }) => {
      const { data, error } = await supabase
        .from('goal_checkins')
        .delete()
        .eq('goal_id', goalId)
        .eq('checkin_date', date)
        .select('id');
      if (error) throw error;
      // A delete that matches no rows succeeds with error === null, which is
      // also what RLS produces for someone else's row. Without this the UI
      // would report success and change nothing - indistinguishable from
      // undo being broken. Same reasoning as useDeleteGoal in useGoals.ts.
      if (!data || data.length === 0) {
        throw new Error("That check-in isn't yours to undo.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goal-checkins', variables.circleId] });
    },
  });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useCheckins.ts`
Expected: both clean.

- [ ] **Step 3: Confirm the tests still pass**

Run: `npm test`
Expected: PASS, 187 tests.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCheckins.ts
git commit -m "Write check-ins to the ledger, append-only and idempotent"
```

---

### Task 4: Creating a goal with an Area and a cadence

**Files:**
- Modify: `src/hooks/useGoals.ts`

**Interfaces:**
- Consumes: `CadenceDraft` from Task 1; `Area` from `src/types/models`.
- Produces: a rewritten `useCreateGoal()` whose mutation takes `{ circleId, userId, areaId, title, cadence }` and returns `Goal`. Tasks 8 and 9 call it. `useUpdateGoal` and `useLogGoalProgress` keep their current signatures until Task 5 and Task 9 respectively.

- [ ] **Step 1: Rewrite the create mutation**

In `src/hooks/useGoals.ts`, replace the `NewGoal` interface and the `useCreateGoal` function with:

```ts
interface NewGoal {
  circleId: string;
  userId: string;
  areaId: string;
  title: string;
  cadence: CadenceDraft;
}

// The numeric `target` is gone from the manual path. A cadence IS the
// target now - "every day", "4x a week" - and the quantity, where there is
// one, lives in the freetext title ("Walk 10,000 steps"). The old form
// could not save "Meditate" at all without inventing a number, and then
// rendered it as a meaningless "0 / 4" progress bar.
//
// target is still written for health_steps goals, where a device compares a
// real number against it; that path is untouched by this plan.
export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, userId, areaId, title, cadence }: NewGoal): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          circle_id: circleId,
          user_id: userId,
          area_id: areaId,
          title,
          // target_type must never be null: the column is nullable with no
          // default, and a null cadence makes isShowingUp return false for
          // the life of the goal.
          target_type: cadence.target_type,
          target_count: cadence.target_count,
          target_weekdays: cadence.target_weekdays,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        // 23505 is goals_one_active_per_area: one active goal per member per
        // Area is the model's hard rule, and Postgres reports the violation
        // as an unreadable constraint string. The user needs to know they
        // already have a goal here and can replace it.
        if (error.code === '23505') {
          throw new Error('You already have a goal in this area. Edit that one instead.');
        }
        throw error;
      }

      // Starting a commitment is a moment the circle should see. Feed-only,
      // no push. Deliberately not awaited into the error path: a failed
      // event insert must not roll back a successfully created goal.
      const { error: eventError } = await supabase.from('events').insert({
        circle_id: circleId,
        user_id: userId,
        type: 'goal_started',
        payload: { title, goal_id: (data as Goal).id, area_id: areaId },
      });
      if (eventError) console.warn('goal_started event failed', eventError.message);

      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}
```

Add `import type { CadenceDraft } from '../lib/cadence';` to the imports, and remove the now-unused `GoalCategory` and `isStepGoal`/`resolveGoalSource` references **only if** nothing else in the file uses them — check before deleting. `useHealthSyncStore` and `resolveGoalSource` are still used by the Health Connect path; leave them alone.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL, with errors in `src/screens/GoalsScreen.tsx` where `useCreateGoal` is called with the old `{ target, category }` shape. That is expected — Task 8 fixes the caller. Record the exact errors.

- [ ] **Step 3: Confirm the failure is confined to the caller**

Run: `npx tsc --noEmit 2>&1 | grep -c "GoalsScreen"`
Expected: every reported error is in `GoalsScreen.tsx`. If any other file errors, you have broken something outside this task's scope — report it.

- [ ] **Step 4: Commit**

The tree does not typecheck between this task and Task 8; that is a deliberate two-task change to one interface. Commit anyway so the interface change is reviewable on its own.

```bash
git add src/hooks/useGoals.ts
git commit -m "Create goals with an Area and a cadence instead of a bare number"
```

---

### Task 5: Replacing, finishing and deleting a goal

**Files:**
- Modify: `src/hooks/useGoals.ts`

**Interfaces:**
- Consumes: `useCreateGoal` (Task 4), `Goal`, `EndedReason`.
- Produces: `useEndGoal()` taking `{ goal, circleId, reason, bestStreak, hadCheckins }` where `reason: EndedReason` and `hadCheckins: boolean`. Replaces the old `useDeleteGoal`. Task 9 calls it twice — once with `reason: 'deleted'`, once with `reason: 'completed'`.

The spec's rule: ending a goal **archives it to `goal_history` and sets `status = 'ended'` — it never deletes the row**, because `events`, `streak_saves`, buddy check-ins, challenges and the life timeline all hold `goal_id`, and deleting would orphan feed entries that are years of a circle's memory.

- [ ] **Step 1: Write the mutation**

In `src/hooks/useGoals.ts`, replace `useDeleteGoal` with:

```ts
// Ending a commitment: archive it, then mark it ended. Never delete the
// goals row - events, streak_saves, buddy check-ins, challenges and the life
// timeline all reference goal_id.
//
// A goal with no check-ins writes NO history row at all. Nothing happened,
// so there is nothing to remember, and a "Previous Goals" list padded with
// commitments nobody ever acted on is noise.
export function useEndGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goal,
      reason,
      bestStreak,
      hadCheckins,
    }: {
      goal: Goal;
      circleId: string;
      reason: EndedReason;
      bestStreak: number;
      hadCheckins: boolean;
    }) => {
      if (hadCheckins) {
        const { error: historyError } = await supabase.from('goal_history').insert({
          goal_id: goal.id,
          circle_id: goal.circle_id,
          user_id: goal.user_id,
          area_id: goal.area_id,
          title: goal.title,
          target_type: goal.target_type,
          target_count: goal.target_count,
          target_weekdays: goal.target_weekdays,
          started_at: goal.started_at,
          best_streak: bestStreak,
          ended_reason: reason,
        });
        if (historyError) throw historyError;
      }

      // .select() is what makes this honest. An update that matches no rows
      // - which is what RLS produces when the goal is not yours - succeeds
      // with error === null and changes nothing, so without this the UI
      // reports success and leaves the goal exactly where it was.
      const { data, error } = await supabase
        .from('goals')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString().slice(0, 10),
          ended_reason: reason,
        })
        .eq('id', goal.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This goal belongs to someone else, so it can't be ended from here.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] });
      queryClient.invalidateQueries({ queryKey: ['goal-history', variables.circleId] });
    },
  });
}
```

Add `EndedReason` to the `import type { ... } from '../types/models'` line.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL only in `GoalsScreen.tsx` (it still calls `useDeleteGoal`). Task 9 fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoals.ts
git commit -m "End goals by archiving them, never by deleting the row"
```

---

### Task 6: Area picker

**Files:**
- Create: `src/components/AreaPicker.tsx`

**Interfaces:**
- Consumes: `Area` from `src/types/models`; `useTheme` from `src/theme/ThemeProvider`; `spacing`, `fontFamily`, `type` from `src/theme/colors`; `AnimatedPressable`.
- Produces: `<AreaPicker areas={Area[]} selectedId={string | null} onSelect={(id: string) => void} />`. Tasks 8 and 9 render it.

- [ ] **Step 1: Write the component**

Create `src/components/AreaPicker.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing, type } from '../theme/colors';
import type { Area } from '../types/models';

// A circle's enabled Areas as selectable chips. The catalog is fixed and
// small (eight, and usually three or four enabled), so every option is
// visible at once rather than hidden behind a dropdown - picking an Area is
// the first decision in creating a goal and should not cost a tap to see.
export function AreaPicker({
  areas,
  selectedId,
  onSelect,
}: {
  areas: readonly Area[];
  selectedId: string | null;
  onSelect: (areaId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (areas.length === 0) {
    return <Text style={styles.empty}>This circle hasn&apos;t turned on any areas yet.</Text>;
  }

  return (
    <View style={styles.row}>
      {areas.map((area) => {
        const selected = area.id === selectedId;
        return (
          <AnimatedPressable
            key={area.id}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onSelect(area.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={area.label}
          >
            <Text style={styles.emoji}>{area.emoji}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{area.label}</Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

function createStyles({ colors, radii, type: t }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.s6,
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.md,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.background },
    emoji: { fontSize: 16 },
    label: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    labelSelected: { color: colors.textPrimary },
    empty: { ...t.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
  });
}
```

Note the `type: t` rename in the destructure — `type` is already imported from the theme module at the top of the file, and shadowing it inside `createStyles` is what every other component here does.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/AreaPicker.tsx`
Expected: both clean. (`GoalsScreen.tsx` errors from Tasks 4–5 are still present and expected; confirm no *new* file errors.)

- [ ] **Step 3: Commit**

```bash
git add src/components/AreaPicker.tsx
git commit -m "Add the Area chooser"
```

---

### Task 7: Cadence picker

**Files:**
- Create: `src/components/CadencePicker.tsx`

**Interfaces:**
- Consumes: `CadenceDraft`, `WEEKDAY_LABELS` from `src/lib/cadence`; `TargetType` from `src/lib/showingUp`.
- Produces: `<CadencePicker value={CadenceDraft} onChange={(next: CadenceDraft) => void} />`. Tasks 8 and 9 render it.

- [ ] **Step 1: Write the component**

Create `src/components/CadencePicker.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { WEEKDAY_LABELS, type CadenceDraft } from '../lib/cadence';
import type { TargetType } from '../lib/showingUp';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing, type } from '../theme/colors';

const CADENCE_OPTIONS: { value: TargetType; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'times_per_week', label: 'Times a week' },
  { value: 'specific_weekdays', label: 'Certain days' },
  { value: 'monthly', label: 'Times a month' },
];

const WEEK_COUNTS = [1, 2, 3, 4, 5, 6, 7];
const MONTH_COUNTS = [1, 2, 3, 4, 5];

// Picking a cadence: the type first, then only the parameters that type
// actually needs. Choosing a type resets the other type's parameters, so a
// draft can never carry a target_count left over from a cadence the user
// moved away from - validateCadence would pass and the database would store
// a count that means nothing.
export function CadencePicker({
  value,
  onChange,
}: {
  value: CadenceDraft;
  onChange: (next: CadenceDraft) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  function selectType(target_type: TargetType) {
    onChange({
      target_type,
      target_count: target_type === 'times_per_week' ? 3 : target_type === 'monthly' ? 1 : null,
      target_weekdays: target_type === 'specific_weekdays' ? [] : null,
    });
  }

  function toggleWeekday(weekday: number) {
    const current = value.target_weekdays ?? [];
    const next = current.includes(weekday)
      ? current.filter((d) => d !== weekday)
      : [...current, weekday].sort((a, b) => a - b);
    onChange({ ...value, target_weekdays: next });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>How often</Text>
      <View style={styles.row}>
        {CADENCE_OPTIONS.map((option) => {
          const selected = value.target_type === option.value;
          return (
            <AnimatedPressable
              key={option.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => selectType(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {value.target_type === 'times_per_week' && (
        <>
          <Text style={styles.label}>How many times a week</Text>
          <View style={styles.row}>
            {WEEK_COUNTS.map((n) => (
              <AnimatedPressable
                key={n}
                style={[styles.countChip, value.target_count === n && styles.chipSelected]}
                onPress={() => onChange({ ...value, target_count: n })}
                accessibilityRole="button"
                accessibilityState={{ selected: value.target_count === n }}
                accessibilityLabel={`${n} times a week`}
              >
                <Text style={[styles.chipText, value.target_count === n && styles.chipTextSelected]}>
                  {n}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </>
      )}

      {value.target_type === 'monthly' && (
        <>
          <Text style={styles.label}>How many times a month</Text>
          <View style={styles.row}>
            {MONTH_COUNTS.map((n) => (
              <AnimatedPressable
                key={n}
                style={[styles.countChip, value.target_count === n && styles.chipSelected]}
                onPress={() => onChange({ ...value, target_count: n })}
                accessibilityRole="button"
                accessibilityState={{ selected: value.target_count === n }}
                accessibilityLabel={`${n} times a month`}
              >
                <Text style={[styles.chipText, value.target_count === n && styles.chipTextSelected]}>
                  {n}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </>
      )}

      {value.target_type === 'specific_weekdays' && (
        <>
          <Text style={styles.label}>Which days</Text>
          <View style={styles.row}>
            {WEEKDAY_LABELS.map((day, index) => {
              const weekday = index + 1;
              const selected = (value.target_weekdays ?? []).includes(weekday);
              return (
                <AnimatedPressable
                  key={day}
                  style={[styles.countChip, selected && styles.chipSelected]}
                  onPress={() => toggleWeekday(weekday)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={day}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{day}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function createStyles({ colors, radii, type: t }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrap: { gap: spacing.s6 },
    label: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
    chip: {
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.md,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    countChip: {
      minWidth: 48,
      alignItems: 'center',
      paddingVertical: spacing.s10,
      paddingHorizontal: spacing.s10,
      borderRadius: radii.input,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.background },
    chipText: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textSecondary },
    chipTextSelected: { color: colors.textPrimary },
  });
}
```

`minWidth: 48` on the count and weekday chips is the 48dp minimum tap target; do not shrink it.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/CadencePicker.tsx`
Expected: clean apart from the known `GoalsScreen.tsx` errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CadencePicker.tsx
git commit -m "Add the cadence chooser"
```

---

### Task 8: Rebuild the add-goal form

**Files:**
- Modify: `src/screens/GoalsScreen.tsx` — the `AddGoalForm` component

**Interfaces:**
- Consumes: `useCreateGoal` (Task 4), `useCircleAreas` (Task 2), `AreaPicker` (Task 6), `CadencePicker` (Task 7), `validateCadence` (Task 1).
- Produces: nothing other tasks consume.

This is where the numeric target field dies.

- [ ] **Step 1: Replace AddGoalForm**

In `src/screens/GoalsScreen.tsx`, replace the whole `AddGoalForm` function with:

```tsx
function AddGoalForm({ circleId, userId }: { circleId: string; userId: string }) {
  const [title, setTitle] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [cadence, setCadence] = useState<CadenceDraft>({
    target_type: 'daily',
    target_count: null,
    target_weekdays: null,
  });
  const [error, setError] = useState<string | null>(null);
  const { data: areas } = useCircleAreas(circleId);
  const createGoal = useCreateGoal();
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // No numeric target to check any more. A cadence is always set (it starts
  // at daily), so what is actually required is a title and an Area.
  const canAdd = !createGoal.isPending && !!title.trim() && !!areaId;

  async function handleAdd() {
    setError(null);
    if (!title.trim() || !areaId) return;

    const cadenceError = validateCadence(cadence);
    if (cadenceError) {
      setError(cadenceError);
      return;
    }

    try {
      await createGoal.mutateAsync({ circleId, userId, areaId, title: title.trim(), cadence });
      setTitle('');
      setAreaId(null);
      setCadence({ target_type: 'daily', target_count: null, target_weekdays: null });
    } catch (err) {
      // useCreateGoal turns the one-active-goal-per-Area constraint into
      // readable copy; anything else surfaces its own message rather than a
      // silent failure.
      setError(err instanceof Error ? err.message : 'Could not add that goal.');
    }
  }

  return (
    <View style={styles.addGoalWrap}>
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Goal</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Walk 10,000 steps"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Area</Text>
        <AreaPicker areas={areas ?? []} selectedId={areaId} onSelect={setAreaId} />

        <CadencePicker value={cadence} onChange={setCadence} />

        {error && <Text style={styles.formError}>{error}</Text>}

        <AnimatedPressable
          style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd }}
          accessibilityLabel="Add goal"
        >
          <Text style={[styles.addButtonText, !canAdd && styles.addButtonTextDisabled]}>
            {createGoal.isPending ? 'Adding…' : 'Add goal'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Update the imports and styles**

Add to the imports at the top of `GoalsScreen.tsx`:

```tsx
import { AreaPicker } from '../components/AreaPicker';
import { CadencePicker } from '../components/CadencePicker';
import { useCircleAreas } from '../hooks/useAreas';
import { validateCadence, describeCadence, type CadenceDraft } from '../lib/cadence';
```

Add one style to `createStyles`, beside the existing `fieldLabel`:

```tsx
    formError: { ...type.caption, fontFamily: fontFamily.semibold, color: colors.danger },
```

Remove the now-unused `GOAL_CATEGORY_OPTIONS` import and any `GoalCategory` import if nothing else in the file uses them — grep first.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `GoalCard`/`EditGoalModal`, which Task 9 rebuilds. Confirm `AddGoalForm` itself is clean.

- [ ] **Step 4: Commit**

```bash
git add src/screens/GoalsScreen.tsx
git commit -m "Replace the numeric target with an Area and a cadence"
```

---

### Task 9: Rebuild the goal card around check-ins

**Files:**
- Modify: `src/screens/GoalsScreen.tsx` — `GoalCard` and `EditGoalModal`
- Create: `src/components/GoalCadenceRow.tsx`

**Interfaces:**
- Consumes: `useGoalCheckins`, `useCheckIn`, `useUndoCheckIn` (Task 3); `useEndGoal` (Task 5); `isShowingUp`, `streak`, `consistency` (Plan 1); `describeCadence` (Task 1).
- Produces: `<GoalCadenceRow cadence checkins now />`.

- [ ] **Step 1: Write the cadence row component**

Create `src/components/GoalCadenceRow.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { describeCadence } from '../lib/cadence';
import { consistency, streak, type Cadence, type CheckinDates } from '../lib/showingUp';
import { useTheme } from '../theme/ThemeProvider';
import { fontFamily, spacing, type } from '../theme/colors';

// One goal's cadence, streak and consistency on a single line.
//
// The streak number is PERIODS, not days - a weekly goal at 12 means twelve
// consecutive weeks. Consistency is measured against the goal's own
// denominator, so a 4x/week goal reads 4/4 and never 4/7; showing 4/7 would
// make someone who fully honoured their commitment look like they had
// missed three days.
export function GoalCadenceRow({
  cadence,
  checkins,
  now,
}: {
  cadence: Cadence;
  checkins: CheckinDates;
  now: number;
}) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const periods = streak(cadence, checkins, now);
  const { done, of } = consistency(cadence, checkins, now);

  return (
    <View style={styles.row}>
      <Text style={styles.cadence}>{describeCadence(cadence)}</Text>
      {periods > 0 && <Text style={styles.streak}>🔥{periods}</Text>}
      {/* of === 0 only happens for a goal with no recognised cadence. Showing
          "0/0" is meaningless, so the figure is simply omitted rather than
          rendered as a ratio nobody can read. */}
      {of > 0 && (
        <Text style={styles.consistency}>
          {done}/{of}
        </Text>
      )}
    </View>
  );
}

function createStyles({ colors, type: t }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10 },
    cadence: { ...t.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
    streak: { ...t.caption, fontFamily: fontFamily.semibold, color: colors.textPrimary },
    consistency: { ...t.caption, fontFamily: fontFamily.regular, color: colors.textSecondary },
  });
}
```

- [ ] **Step 2: Rewire GoalCard's check-in action**

Inside `GoalCard` in `GoalsScreen.tsx`, replace the progress-bar block and the `logGoal` call with a check-in toggle. The three changes:

Replace `const isComplete = goal.progress >= goal.target;` with:

```tsx
  const cadence = {
    target_type: goal.target_type,
    target_count: goal.target_count,
    target_weekdays: goal.target_weekdays,
  };
  const myCheckins = checkinsByGoal[goal.id] ?? [];
  const today = toIsoDate(new Date());
  const checkedInToday = myCheckins.includes(today);
  const showingUp = isShowingUp(cadence, myCheckins, Date.now());
```

Replace the `<ProgressBar progress={goal.progress} target={goal.target} />` line and the `{goal.progress} / {goal.target}` text with:

```tsx
      <GoalCadenceRow cadence={cadence} checkins={myCheckins} now={Date.now()} />
```

Replace the log/complete button's `onPress` with a check-in toggle:

```tsx
        onPress={() =>
          checkedInToday
            ? undoCheckIn.mutate({ goalId: goal.id, circleId, date: today })
            : checkIn.mutate({ goalId: goal.id, circleId, userId })
        }
```

and its label with `checkedInToday ? 'Done today' : 'Check in'`.

`ProgressBar` may become unused in this file — grep before removing its import.

- [ ] **Step 3: Replace EditGoalModal's numeric field**

Replace the whole `EditGoalModal` function in `GoalsScreen.tsx` with:

```tsx
function EditGoalModal({ goal, circleId, onClose }: { goal: Goal; circleId: string; onClose: () => void }) {
  const [title, setTitle] = useState(goal.title);
  const [cadence, setCadence] = useState<CadenceDraft>({
    target_type: goal.target_type,
    target_count: goal.target_count,
    target_weekdays: goal.target_weekdays,
  });
  const [error, setError] = useState<string | null>(null);
  const updateGoal = useUpdateGoal();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleSave() {
    setError(null);
    if (!title.trim()) return;
    const cadenceError = validateCadence(cadence);
    if (cadenceError) {
      setError(cadenceError);
      return;
    }
    await updateGoal.mutateAsync({ goalId: goal.id, circleId, title: title.trim(), cadence });
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit goal</Text>
          <TextInput style={styles.modalInput} value={title} onChangeText={setTitle} placeholder="Goal title" />
          <CadencePicker value={cadence} onChange={setCadence} />
          {error && <Text style={styles.formError}>{error}</Text>}
          <View style={styles.modalButtons}>
            <PillButton label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <PillButton
              label="Save"
              onPress={handleSave}
              loading={updateGoal.isPending}
              disabled={!title.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

There is deliberately no `AreaPicker` here. Moving a goal to a different Area is a *replacement*, not an edit — it resets the streak and archives the old commitment — and that flow belongs to Plan 3's Area detail screen. Editing the title or the cadence in place keeps the streak, because it is the same commitment.

Update `useUpdateGoal` in `src/hooks/useGoals.ts` to take and write `target_type`, `target_count`, `target_weekdays` instead of `target`:

```ts
export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      title,
      cadence,
    }: {
      goalId: string;
      circleId: string;
      title: string;
      cadence: CadenceDraft;
    }): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .update({
          title,
          target_type: cadence.target_type,
          target_count: cadence.target_count,
          target_weekdays: cadence.target_weekdays,
        })
        .eq('id', goalId)
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}
```

Note this edits the goal in place and does **not** reset the streak, because the Area has not changed. The spec's streak reset applies to *replacing* a goal within an Area — that is Plan 3's Area detail flow, not this in-place edit.

- [ ] **Step 4: Add the hooks and imports GoalCard now needs**

At the top of `GoalsScreen`'s list component, add:

```tsx
  const { data: checkinsByGoal = {} } = useGoalCheckins(circleId);
```

and pass `checkinsByGoal` down to each `GoalCard`. Add the imports:

```tsx
import { GoalCadenceRow } from '../components/GoalCadenceRow';
import { useGoalCheckins, useCheckIn, useUndoCheckIn } from '../hooks/useCheckins';
import { useEndGoal } from '../hooks/useGoals';
import { isShowingUp, streak } from '../lib/showingUp';
import { toIsoDate } from '../lib/periods';
```

- [ ] **Step 5: Wire both ways a commitment ends**

`GoalCard` already opens an `ActionSheet` for its overflow menu. It must now offer two endings, both of which return the Area to "No goal yet":

```tsx
const endGoal = useEndGoal();

function endWith(reason: EndedReason) {
  setMenuOpen(false);
  endGoal.mutate(
    {
      goal,
      circleId,
      reason,
      bestStreak: streak(cadence, myCheckins, Date.now()),
      hadCheckins: myCheckins.length > 0,
    },
    {
      onError: (err) =>
        Alert.alert('Could not end this goal', err instanceof Error ? err.message : 'Please try again.'),
    },
  );
}
```

In the menu's `options` array, replace the old Delete entry with these two:

```tsx
  { label: "I've finished this", onPress: () => endWith('completed') },
  { label: 'Delete', destructive: true, onPress: () => endWith('deleted') },
```

Both exist because a cadence goal is open-ended and has no finish line — without the first, nothing in the model could ever produce `ended_reason = 'completed'`, and a member who genuinely completed a commitment would have to record it as a deletion. Deleting is not a failure either: choosing not to participate in an Area for now is a valid resting state and is never rendered as one.

Add `EndedReason` to the `import type { ... } from '../types/models'` line in `GoalsScreen.tsx`, and confirm `Alert` is already imported (it is — the file uses it for error alerts).

- [ ] **Step 6: Typecheck, lint and test**

Run: `npx tsc --noEmit && npx eslint src/screens/GoalsScreen.tsx src/components/GoalCadenceRow.tsx && npm test`
Expected: all clean; 187 tests pass. This is the first point since Task 4 where the tree typechecks — it must be clean here.

- [ ] **Step 7: Commit**

```bash
git add src/screens/GoalsScreen.tsx src/components/GoalCadenceRow.tsx src/hooks/useGoals.ts
git commit -m "Check in against a cadence instead of filling a progress bar"
```

---

### Task 10: Hide ended goals, and say so

**Files:**
- Modify: `src/hooks/useGoals.ts` — `useGoals`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useGoals` filtered to active goals.

**Read this before starting.** Migration 0047 set `status = 'ended'` on every goal whose `category` was NULL or `misc` — potentially a large share of every circle's goals. Nothing filters on `status` today, so those goals still appear exactly as before. This task adds the filter, which is correct, and which will make them disappear from the Goals tab in one release.

- [ ] **Step 1: Confirm the blast radius before changing anything**

Ask the human to run, against the live database:

```sql
select status, count(*) from goals where deleted_at is null group by 1;
select ended_reason, needs_review, count(*) from goal_history group by 1,2;
```

If `ended` is a large fraction of the total, STOP and report the numbers rather than proceeding — the product decision (restore them, prompt for an Area, or leave them archived) has to be made before the filter ships. Do not guess.

- [ ] **Step 2: Add the filter**

```ts
export function useGoals(circleId: string | undefined) {
  return useQuery({
    queryKey: ['goals', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Goal[]> => {
      // Ended goals stay in the table forever - events, streak_saves, buddy
      // check-ins, challenges and the life timeline all hold goal_id - so
      // every reader has to filter them out explicitly. Migration 0047 ended
      // every goal whose old category could not be mapped to an Area, so
      // this filter is the moment those stop appearing on the Goals tab.
      // They are not lost: goal_history holds each one, flagged needs_review.
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('circle_id', circleId as string)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });
}
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: clean, 187 tests.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGoals.ts
git commit -m "Stop showing ended goals on the Goals tab"
```

---

## Verification

```bash
npm test                # 187 tests
npx tsc --noEmit        # clean
npx eslint src/lib src/hooks src/components src/screens
```

Then on a device, against the live database:

1. Add a goal — pick an Area, type a title, pick "Every day". It saves with no number anywhere.
2. Try to add a second goal in the same Area. It refuses with *"You already have a goal in this area. Edit that one instead."*, not a Postgres error.
3. Tap "Check in". The button becomes "Done today" and 🔥1 appears.
4. Tap it again (undo), then again. No duplicate row, no error — the ledger is idempotent.
5. Add a "4× a week" goal. It shows "4× a week" and "1/4", not "1/7".
6. Delete a goal that has check-ins; confirm a `goal_history` row exists for it.
7. Delete a goal with no check-ins; confirm **no** `goal_history` row was written.
8. Use "I've finished this" on a goal with check-ins; confirm its `goal_history` row has `ended_reason = 'completed'`.

## Out of scope

- Circle tab Area rollup, Area detail screen, Manage Areas — Plan 3.
- Feed events beyond `goal_started`, onboarding default Areas — Plan 3.
- Garden, `needsAttention`, `weeklyHighlight`, the two edge functions, `sync_step_goal`, and the 5-pillar → 8-Area taxonomy migration — Plan 4.
- Replacing a goal within an Area (which resets the streak and archives with `ended_reason = 'replaced'`) — Plan 3, where the Area detail screen owns it.
