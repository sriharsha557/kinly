# Areas of Growth — Consumer Rewrites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every feature that still reads `goals.streak_count` and `goals.last_logged_date` onto the `goal_checkins` ledger, so a member who checks in daily sees a growing plant, a real streak and an accurate digest instead of a wilted plant and 0% circle health.

**Architecture:** One pure module, `memberActivity.ts`, collapses a circle's goals plus its check-in ledger into a per-member summary — best streak, last check-in, how many goals they are showing up for. Every client consumer reads that instead of querying `goals` for the two legacy columns. The two Deno edge functions and the `water_streak` RPC get SQL equivalents, because they cannot import `src/lib`.

**Tech Stack:** Expo 54 / React Native 0.81, TanStack Query v5, Supabase JS v2, Deno edge functions, Postgres, TypeScript 5.9, `node --experimental-strip-types --test`.

## Why this plan exists

Plan 2 built the write path: a member sets a commitment with a cadence and taps to check in, which appends to `goal_checkins`. But **nothing downstream reads that ledger.** `useGarden`, `needsAttention`, `CircleHealthCard`, `GardenHero`, the buddy grace window, `useWeeklyRecap`, `useProfileStats`, `daily-digest` and `check-streaks-at-risk` all derive from `goals.streak_count` and `goals.last_logged_date`, which `useCheckIn` never writes.

Today that means: check in every day for a month, and the garden still shows a wilted plant, circle health reads 0%, no streak badge appears, the weekly recap is empty, and no streak-at-risk reminder ever fires. Plan 2 and this plan therefore **ship as one release**.

## What already exists (do not rebuild)

- `src/lib/periods.ts` — `toIsoDate`, `toLocalDate`, `addDays`, `startOfWeek`, `startOfMonth`, `isoWeekday`, `daysRemainingInWeek`, `daysRemainingInMonth`, `WEEK_STARTS_ON`.
- `src/lib/showingUp.ts` — `Cadence`, `CheckinDates`, `TargetType`, `isShowingUp(cadence, checkins, now)`, `streak(cadence, checkins, now)` (PERIODS, not days), `consistency(cadence, checkins, now)`.
- `src/lib/circleRollup.ts` — `areaRollup`, `circleActivityStreak`.
- `src/lib/cadence.ts` — `describeCadence`, `validateCadence`, `CadenceDraft`, `WEEKDAY_LABELS`.
- `src/lib/errorMessage.ts` — `errorMessage(err, fallback)`; supabase-js returns plain objects, not `Error`s.
- `src/hooks/useCheckins.ts` — `useGoalCheckins(circleId)` → `Record<string, string[]>` keyed by goal_id; `useCheckIn()`; `useUndoCheckIn()`.
- Migrations 0046–0049, **all applied to the live database**, including the `goal_showing_up` view and the `showing_up_at(target_type, target_count, target_weekdays, checkins, day)` SQL function.

188 tests pass at the start of this plan.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-areas-of-growth-design.md`.
- **Expo is 54.** Build against 54, not the v57 in `AGENTS.md`.
- **Never write the phrase "on track"** in any identifier, comment or user-visible string. The primitive is *showing up*. (One pre-existing violation lives in `src/components/BuddyCard.tsx` — Task 10 removes it.)
- **Streaks are PERIODS, not days.** A weekly goal at 12 means twelve consecutive weeks. Any copy saying "N-day streak" must become period-aware or drop the unit.
- **Weeks start Monday**, ISO-8601, local time. `WEEK_STARTS_ON` in `periods.ts` and `date_trunc('week', …)` in SQL agree; do not change one without the other.
- **Do not delete `goals.streak_count`, `last_logged_date`, `progress` or `target`.** They still back the Health Connect step path and legacy rows. This plan stops *reading* them for cadence goals; a later plan removes them.
- **`goal_checkins` has no UPDATE policy.** Write with a plain `.insert()` and swallow Postgres **23505** as the repeat no-op. `.upsert()` is rejected by RLS with 42501. `ignoreDuplicates` is an option on `.upsert()` only — it does not exist on `.insert()`.
- **RLS enforces `checkin_date <= current_date`** for member inserts. Anything that writes a *past* check-in on someone else's behalf must be `security definer` SQL.
- **No raw hex in components.** Colour from `useTheme()`; spacing, type and `touch` tokens from `src/theme/colors`.
- Tests: `npm test`. Typecheck: `npx tsc --noEmit`. Lint: `npx eslint src supabase`.
- **No Docker and no local Postgres.** Migrations are written here and applied by hand through the Supabase Dashboard. Do not attempt `supabase db reset` / `start` / `execute`.
- Commit after every task.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/memberActivity.ts` (create) | Pure: goals + ledger → per-member summary. No React, no Supabase. |
| `src/lib/memberActivity.test.ts` (create) | Unit tests for the above. |
| `src/hooks/useMemberActivity.ts` (create) | Fetches a circle's goals + check-ins, returns the summary map. |
| `src/hooks/useGarden.ts` (modify) | Derive stage and health from the summary. |
| `src/lib/needsAttention.ts` (modify) | Take the summary instead of raw goals. |
| `src/hooks/useWeeklyRecap.ts` (modify) | Best streak and health from the summary. |
| `src/hooks/useProfileStats.ts` (modify) | Count check-ins, not numeric completions. |
| `supabase/migrations/0050_checkin_backed_rpcs.sql` (create) | `sync_step_goal` and `water_streak` write to the ledger. |
| `supabase/functions/check-streaks-at-risk/index.ts` (modify) | At-risk from the ledger. |
| `supabase/functions/daily-digest/digest.ts` (modify) | Digest counts from the ledger. |
| `src/components/TodayGoalsChecklist.tsx` (modify) | List cadence goals; check-in instead of log. |
| `src/components/BuddyCard.tsx` (modify) | Grace window from the summary; fix the naming violation. |

| `src/hooks/useCircleAI.ts` (modify) | Per-Area strength from the ledger, not per-pillar `streak_count`. |

Tasks 1–2 build the shared source. Tasks 3–6 move client consumers onto it. Tasks 7–9 do the SQL and Deno side. Tasks 10–11 finish the UI.

## A note on this plan's precision

Tasks 1–4 carry complete code. **Tasks 5–11 do not** — they name the exact
file, the exact reads to replace, the exact behaviour to preserve, and the
exact copy to use, but they leave the surrounding shape to be read from the
file. That is deliberate: each of those touches a file whose existing logic
(digest windowing, mute fail-closed behaviour, loading/error precedence,
per-circle try/catch) has already survived a review round and must not be
rewritten from a plan author's memory of it. Every one of those tasks names
what must survive; an implementer who cannot preserve it should stop and
report rather than improvise.

---

### Task 1: The shared member summary

**Files:**
- Create: `src/lib/memberActivity.ts`
- Test: `src/lib/memberActivity.test.ts`

**Interfaces:**
- Consumes: `Cadence`, `CheckinDates`, `isShowingUp`, `streak` from `src/lib/showingUp.ts`.
- Produces: `ActivityGoal`, `MemberActivity`, `memberActivity(goals, checkinsByGoal, now): Map<string, MemberActivity>`, `EMPTY_ACTIVITY`. Tasks 2–6 and 10 all use these.

Every consumer in this plan wants one of three things about a member: their best streak, when they last did anything, and whether they are currently showing up. Nine separate reimplementations is how `isInGraceWindow` ended up copied into three files. One module answers all three.

- [ ] **Step 1: Write the failing test**

Create `src/lib/memberActivity.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberActivity, EMPTY_ACTIVITY, type ActivityGoal } from './memberActivity.ts';

// Wednesday 2026-08-05, midday.
const WED = new Date(2026, 7, 5, 12).getTime();

const daily = (id: string, user_id: string): ActivityGoal => ({
  id,
  user_id,
  target_type: 'daily',
  target_count: null,
  target_weekdays: null,
});

test('a member with no goals is absent from the map', () => {
  const map = memberActivity([], {}, WED);
  assert.equal(map.size, 0);
  assert.deepEqual(map.get('u1'), undefined);
});

test('EMPTY_ACTIVITY is the neutral value for a member with no goals', () => {
  // Callers render this rather than branching on undefined - a member who
  // set no goal is at rest, not behind.
  assert.equal(EMPTY_ACTIVITY.bestStreak, 0);
  assert.equal(EMPTY_ACTIVITY.lastCheckinDate, null);
  assert.equal(EMPTY_ACTIVITY.showingUp, 0);
  assert.equal(EMPTY_ACTIVITY.goalCount, 0);
});

test('best streak is the longest across a member s goals', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u1')];
  const checkins = {
    g1: ['2026-08-05', '2026-08-04'],
    g2: ['2026-08-05', '2026-08-04', '2026-08-03', '2026-08-02'],
  };
  const activity = memberActivity(goals, checkins, WED).get('u1');
  assert.equal(activity?.bestStreak, 4);
});

test('last check-in is the most recent across a member s goals', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u1')];
  const checkins = { g1: ['2026-08-01'], g2: ['2026-08-04'] };
  const activity = memberActivity(goals, checkins, WED).get('u1');
  assert.equal(activity?.lastCheckinDate, '2026-08-04');
});

test('showingUp counts goals the member is honouring, not check-ins', () => {
  const fourPerWeek: ActivityGoal = {
    id: 'g3',
    user_id: 'u1',
    target_type: 'times_per_week',
    target_count: 4,
    target_weekdays: null,
  };
  // g1 daily, not done today -> not showing up.
  // g3 4x/week, nothing logged, Wednesday -> still reachable, showing up.
  const activity = memberActivity([daily('g1', 'u1'), fourPerWeek], { g1: [], g3: [] }, WED).get('u1');
  assert.equal(activity?.showingUp, 1);
  assert.equal(activity?.goalCount, 2);
});

test('members are kept separate', () => {
  const goals = [daily('g1', 'u1'), daily('g2', 'u2')];
  const checkins = { g1: ['2026-08-05'], g2: [] };
  const map = memberActivity(goals, checkins, WED);
  assert.equal(map.get('u1')?.bestStreak, 1);
  assert.equal(map.get('u2')?.bestStreak, 0);
  assert.equal(map.get('u2')?.lastCheckinDate, null);
});

test('a goal with no check-ins contributes nothing but still counts', () => {
  const activity = memberActivity([daily('g1', 'u1')], {}, WED).get('u1');
  assert.equal(activity?.bestStreak, 0);
  assert.equal(activity?.lastCheckinDate, null);
  assert.equal(activity?.goalCount, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './memberActivity.ts'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/memberActivity.ts`:

```ts
// A circle's goals plus its check-in ledger, collapsed to one row per
// member: their best streak, when they last did anything, and how many of
// their commitments they are currently honouring.
//
// This exists because nine different features wanted the same three facts
// and each used to compute them from goals.streak_count and
// goals.last_logged_date - columns the check-in ledger does not write. The
// previous round of that duplication put isInGraceWindow in three separate
// files, which then disagreed.
//
// Dependency-free apart from showingUp.ts, so node:test can import it under
// --experimental-strip-types.

import { isShowingUp, streak, type Cadence, type CheckinDates } from './showingUp.ts';

export interface ActivityGoal extends Cadence {
  id: string;
  user_id: string;
}

export interface MemberActivity {
  bestStreak: number;
  lastCheckinDate: string | null;
  showingUp: number;
  goalCount: number;
}

// The neutral value for a member with no goals. Callers render this instead
// of branching on undefined, because someone who has not set a goal is at
// rest rather than behind, and every surface should say so the same way.
export const EMPTY_ACTIVITY: MemberActivity = {
  bestStreak: 0,
  lastCheckinDate: null,
  showingUp: 0,
  goalCount: 0,
};

export function memberActivity(
  goals: readonly ActivityGoal[],
  checkinsByGoal: Readonly<Record<string, CheckinDates>>,
  now: number,
): Map<string, MemberActivity> {
  const byMember = new Map<string, MemberActivity>();

  for (const goal of goals) {
    const checkins = checkinsByGoal[goal.id] ?? [];
    const current = byMember.get(goal.user_id) ?? { ...EMPTY_ACTIVITY };

    // Streaks are periods in each goal's own cadence, so the max across a
    // member's goals is not comparable in units - but it is the right
    // headline number: it answers "what is the best thing they have going".
    current.bestStreak = Math.max(current.bestStreak, streak(goal, checkins, now));

    for (const date of checkins) {
      const day = date.slice(0, 10);
      if (current.lastCheckinDate === null || day > current.lastCheckinDate) {
        current.lastCheckinDate = day;
      }
    }

    if (isShowingUp(goal, checkins, now)) current.showingUp += 1;
    current.goalCount += 1;

    byMember.set(goal.user_id, current);
  }

  return byMember;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 195 tests (188 + 7 new).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
npx eslint src/lib/memberActivity.ts
git add src/lib/memberActivity.ts src/lib/memberActivity.test.ts
git commit -m "Give every consumer one source for what a member has been doing"
```

---

### Task 2: The hook that feeds it

**Files:**
- Create: `src/hooks/useMemberActivity.ts`

**Interfaces:**
- Consumes: `memberActivity`, `ActivityGoal`, `MemberActivity` (Task 1); `useGoals` from `src/hooks/useGoals.ts`; `useGoalCheckins` from `src/hooks/useCheckins.ts`.
- Produces: `useMemberActivity(circleId): { activity: Map<string, MemberActivity>; isLoading: boolean; isError: boolean }`. Tasks 3, 4, 5 and 10 consume it.

No unit test: it is a composition of two existing queries, and the suite has no React renderer. Verified by typecheck and by its consumers.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useMemberActivity.ts`:

```ts
import { useMemo } from 'react';
import { useGoals } from './useGoals';
import { useGoalCheckins } from './useCheckins';
import { memberActivity, type ActivityGoal, type MemberActivity } from '../lib/memberActivity';

// Composes the two queries every derived surface needs, so the garden, the
// attention list and the weekly recap cannot disagree about what a member
// has been doing - they read one map built from one pair of queries, and
// TanStack de-duplicates the underlying fetches by key.
export function useMemberActivity(circleId: string | undefined): {
  activity: Map<string, MemberActivity>;
  isLoading: boolean;
  isError: boolean;
} {
  const goalsQuery = useGoals(circleId);
  const checkinsQuery = useGoalCheckins(circleId);

  const activity = useMemo(() => {
    const goals: ActivityGoal[] = (goalsQuery.data ?? []).map((g) => ({
      id: g.id,
      user_id: g.user_id,
      target_type: g.target_type,
      target_count: g.target_count,
      target_weekdays: g.target_weekdays,
    }));
    return memberActivity(goals, checkinsQuery.data ?? {}, Date.now());
  }, [goalsQuery.data, checkinsQuery.data]);

  return {
    activity,
    isLoading: goalsQuery.isLoading || checkinsQuery.isLoading,
    // Surfaced rather than swallowed: a derived screen that silently renders
    // zeros on a failed query tells the circle nobody is doing anything,
    // which is the single most damaging thing it could say.
    isError: goalsQuery.isError || checkinsQuery.isError,
  };
}
```

- [ ] **Step 2: Typecheck, lint, test**

Run: `npx tsc --noEmit && npx eslint src/hooks/useMemberActivity.ts && npm test`
Expected: clean; 195 tests.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMemberActivity.ts
git commit -m "Compose goals and the ledger into one activity map"
```

---

### Task 3: The garden grows from check-ins

**Files:**
- Modify: `src/hooks/useGarden.ts`

**Interfaces:**
- Consumes: `useMemberActivity` (Task 2), `EMPTY_ACTIVITY` (Task 1).
- Produces: `useGardenState(circleId)` unchanged in shape — still `{ members: MemberGardenState[]; health: number }`, so `GardenHero` and `CircleHealthCard` need no edits.

`stageFor` currently takes `(maxStreak, mostRecentDate)` derived from `goals.streak_count` / `last_logged_date`. Those are the columns the ledger does not write. Feed it the same two values from `memberActivity` instead. **Keep `stageFor` and its `growthVisual` call exactly as they are** — the 3/14/30 thresholds and the `wilted` rule are unchanged, and the `> 3` wilt threshold must stay in agreement with `needsAttention.ts`.

- [ ] **Step 1: Rewrite the query body**

Replace the `queryFn` in `useGardenState` so it fetches only members, and takes activity from the hook. The whole hook becomes:

```ts
export function useGardenState(circleId: string | undefined) {
  const { activity } = useMemberActivity(circleId);
  const membersQuery = useQuery({
    queryKey: ['garden-members', circleId],
    enabled: !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('user_id, profiles(name)')
        .eq('circle_id', circleId as string)
        .eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
  });

  const data: GardenState | undefined = useMemo(() => {
    if (!membersQuery.data) return undefined;
    const members: MemberGardenState[] = membersQuery.data.map((m) => {
      const agg = activity.get(m.user_id) ?? EMPTY_ACTIVITY;
      const profile = m.profiles as unknown as { name: string } | null;
      return {
        userId: m.user_id,
        name: profile?.name ?? 'Member',
        // Same two inputs as before - a best streak and a most recent date -
        // but sourced from the check-in ledger rather than from
        // goals.streak_count / last_logged_date, which nothing writes for a
        // cadence commitment.
        stage: stageFor(agg.bestStreak, agg.lastCheckinDate),
        streak: agg.bestStreak,
      };
    });
    const activeCount = members.filter((m) => m.stage !== 'wilted').length;
    const health = members.length > 0 ? Math.round((activeCount / members.length) * 100) : 0;
    return { members, health };
  }, [membersQuery.data, activity]);

  return { ...membersQuery, data };
}
```

Add `import { useMemo } from 'react';`, `import { useMemberActivity } from './useMemberActivity';` and `import { EMPTY_ACTIVITY } from '../lib/memberActivity';`. Remove the now-unused `goals` fetch and any import it alone needed — grep before deleting.

- [ ] **Step 2: Check every consumer of the return value still compiles**

Run: `npx tsc --noEmit`
Expected: clean. `useGardenState` is consumed by `GardenHero`, `CircleHealthCard`, `CircleScreen` and `BuddyCard`; spreading `membersQuery` preserves `isLoading`, `isError` and `refetch`, so none should need changes. If any errors, report which — do not widen the return type to silence it.

- [ ] **Step 3: Confirm the invalidation key still fires**

`useLogGoalProgress` and `useSyncStepGoal` in `src/hooks/useGoals.ts` invalidate `['garden', circleId]`. That key no longer exists — the garden now derives from `['goals', …]` and `['goal-checkins', …]`. Remove those two stale invalidations and add a comment saying the garden is derived from those queries now, so invalidating them is what refreshes it.

- [ ] **Step 4: Test and commit**

```bash
npm test          # 195
npx eslint src/hooks/useGarden.ts src/hooks/useGoals.ts
git add src/hooks/useGarden.ts src/hooks/useGoals.ts
git commit -m "Grow the garden from check-ins instead of a column nothing writes"
```

---

### Task 4: Who needs attention, from the ledger

**Files:**
- Modify: `src/lib/needsAttention.ts`
- Modify: `src/lib/needsAttention.test.ts`
- Modify: `src/screens/CircleScreen.tsx` (the actual caller — `CircleTodaySection` only renders the rows it is handed)

**Interfaces:**
- Consumes: `MemberActivity`, `EMPTY_ACTIVITY` (Task 1).
- Produces: `needsAttention(input)` where `input.activity: Map<string, MemberActivity>` replaces `input.goals`. `isInGraceWindow(lastCheckinDate, now)` keeps its signature.

**A real behaviour change to make deliberately.** The old `streak_at_risk` row named a specific goal (`goalId`) so the circle could water it, and said "N-day streak ends today". Under the ledger:
- "at risk" means the member's most recent check-in was exactly 2 calendar days ago — the same grace window `water_streak` enforces server-side. That is now a *member-level* fact, not a per-goal one.
- The detail copy must drop the day unit, because a streak is periods now: use `` `${bestStreak}-period streak ends today` ``? No — that is jargon. Use **`streak ends today`** with no number, and keep `bestStreak` out of the string. A number whose unit changes per goal cannot be stated safely in one sentence.

`goalId` still has to be produced, because `water_streak` takes one. Add `goalId` to `MemberActivity`? **No** — instead `needsAttention` takes an extra `atRiskGoalByMember: Record<string, string>` map, built by the caller from the member's longest-streak goal. That keeps `memberActivity` free of water-streak concerns.

- [ ] **Step 1: Update the tests first**

In `src/lib/needsAttention.test.ts`, replace every `goals: [...]` fixture with an `activity` map and an `atRiskGoalByMember` record. For example, a member whose streak is at risk becomes:

```ts
const activity = new Map([
  ['u2', { bestStreak: 5, lastCheckinDate: '2026-08-03', showingUp: 0, goalCount: 1 }],
]);
const atRiskGoalByMember = { u2: 'g2' };
const rows = needsAttention({
  members: [{ userId: 'u2', name: 'Sara' }],
  activity,
  atRiskGoalByMember,
  toughToday: [],
  viewerId: 'u1',
  now: new Date(2026, 7, 5, 12).getTime(),
});
assert.equal(rows[0].reason, 'streak_at_risk');
assert.equal(rows[0].detail, 'streak ends today');
assert.equal(rows[0].goalId, 'g2');
```

Keep every existing test for `tough_day`, `quiet`, the never-logged exclusion and the ranking — only their fixtures change, not their expectations.

- [ ] **Step 2: Run and watch them fail**

Run: `npm test`
Expected: FAIL — the `AttentionInput` type has no `activity` property.

- [ ] **Step 3: Change the module**

In `src/lib/needsAttention.ts`:
- Replace `goals` in `AttentionInput` with `activity: ReadonlyMap<string, MemberActivity>` and `atRiskGoalByMember: Readonly<Record<string, string>>`.
- `isInGraceWindow` keeps `daysSince(date, now) === 2` and its comment — the rule is unchanged, only its input's origin.
- The at-risk branch reads `activity.get(member.userId)?.lastCheckinDate` instead of scanning goals, and `atRiskGoalByMember[member.userId]` for the id.
- Detail copy becomes the literal `'streak ends today'`. Add a comment: a streak is counted in the goal's own periods now, so a single sentence cannot state a unit that is true for every goal at once.
- The never-logged exclusion becomes `lastCheckinDate === null` — keep the comment explaining why chasing someone who joined yesterday is hostile.
- The `quietDays > 3` threshold and its comment stay exactly as they are.

- [ ] **Step 4: Update the caller**

`src/screens/CircleScreen.tsx` calls `needsAttention` — `CircleTodaySection` only renders the `rows` prop it is handed. Give `CircleScreen` `useMemberActivity(circleId)` for the map, and build `atRiskGoalByMember` from `useGoals` — for each member, the id of their goal with the longest streak. Read the file first and follow its existing loading/error precedence; a previous review found this component rendering "no one needs support" before its queries resolved, so **error and loading must both be handled before the empty state**.

- [ ] **Step 5: Test and commit**

```bash
npm test          # 195, with the rewritten needsAttention tests passing
npx tsc --noEmit
npx eslint src/lib/needsAttention.ts src/components/CircleTodaySection.tsx
git add src/lib/needsAttention.ts src/lib/needsAttention.test.ts src/components/CircleTodaySection.tsx
git commit -m "Decide who needs support from the ledger, not from a stale column"
```

---

### Task 5: Weekly recap and profile stats

**Files:**
- Modify: `src/hooks/useWeeklyRecap.ts`
- Modify: `src/hooks/useProfileStats.ts`

**Interfaces:**
- Consumes: `useMemberActivity` (Task 2).
- Produces: both hooks keep their current return shapes, so `WeeklyRecapCard` and `ProfileScreen` need no changes.

- [ ] **Step 1: Rewrite the recap's two legacy reads**

`useWeeklyRecap` currently does two things this plan invalidates:
- `bestStreak` from `.from('goals').select('streak_count').order('streak_count', …)` — replace with the maximum `bestStreak` across `useMemberActivity`'s map.
- `mostRecentByUser` from `.select('user_id, last_logged_date')` — replace with each member's `lastCheckinDate` from the same map.

Leave `goalsCompleted`, `streakMilestones`, `nudgesSent` and `asksPosted` alone: they count `events` rows, which are still written.

- [ ] **Step 2: Rewrite profile stats**

`useProfileStats` counts "goals completed" as `progress >= target`, which has no meaning for a cadence commitment. Replace that with a count of the member's **check-ins in the period the hook already covers**, and `activeGoals` with the number of their active goals. Read the file first; keep its existing return keys so `ProfileScreen` is untouched. Delete the `numericGoals` filter added as a stopgap in the previous plan, and the `completionRate` if nothing renders it once the numeric notion is gone — grep `ProfileScreen.tsx` before removing a key.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npm test && npx eslint src/hooks/useWeeklyRecap.ts src/hooks/useProfileStats.ts
git add src/hooks/useWeeklyRecap.ts src/hooks/useProfileStats.ts
git commit -m "Recap and profile stats read the ledger"
```

---

### Task 6: Today's Mission lists commitments again

**Files:**
- Modify: `src/components/TodayGoalsChecklist.tsx`

**Interfaces:**
- Consumes: `useGoalCheckins`, `useCheckIn` from `src/hooks/useCheckins.ts`; `isShowingUp` from `src/lib/showingUp.ts`; `describeCadence` from `src/lib/cadence.ts`.

Plan 2 left this component excluding every cadence goal (`g.target != null`), with a stopgap so it would not falsely claim "Everything logged for today." Now make it correct: list cadence commitments that have no check-in today, and tapping one writes a check-in.

- [ ] **Step 1: Replace the pending filter**

A commitment is "pending today" when it belongs to the viewer, is not `health_steps`, and has no check-in dated today. Keep the numeric branch for legacy goals that still have a target, so both kinds appear while both exist. Remove the stopgap comment and the `g.target != null` exclusion.

- [ ] **Step 2: Route the tap to a check-in**

For a cadence goal, the row's action calls `useCheckIn().mutate({ goalId, circleId, userId })`, not `logGoal`. Add an `onError` using `errorMessage` from `src/lib/errorMessage.ts` — a silent failure here is the worst case, because this is the component whose whole job is to say what is left to do.

- [ ] **Step 3: Show the cadence**

Each row shows `describeCadence(goal)` as its subtitle so "Walk 10,000 steps" and "Every day" read together. Use the theme's `type.caption` and `colors.textSecondary`; no raw hex.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test && npx eslint src/components/TodayGoalsChecklist.tsx
git add src/components/TodayGoalsChecklist.tsx
git commit -m "List cadence commitments on Today's Mission and check them in"
```

---

### Task 7: The RPCs write to the ledger

**Files:**
- Create: `supabase/migrations/0050_checkin_backed_rpcs.sql`

**Interfaces:**
- Produces: rewritten `sync_step_goal(p_goal_id uuid, p_steps integer)` and `water_streak(...)`.

**No Docker, no Postgres — write this file, do not run it.** Read `supabase/migrations/0033_step_goal_sync.sql`, `0025_streak_saves.sql` and `0035_streak_save_reason.sql` in full first, and reproduce each function's existing signature and return type exactly; changing a signature breaks its caller.

Two rewrites:

**`sync_step_goal`** currently computes its own streak into `goals.streak_count`. It must instead insert a `goal_checkins` row for `current_date` when the device crosses the threshold, and stop touching `streak_count`. Keep writing `progress` and `last_synced_date` — the step UI still shows today's count against the threshold. Use `insert … on conflict do nothing` so a re-sync on the same day is idempotent. Keep it `security definer` and keep its existing ownership check (`user_id = auth.uid()`).

**`water_streak`** saves a friend's streak. Under the ledger that means inserting a check-in **for the missed day**, which a member cannot do for someone else — the RLS insert policy requires `user_id = auth.uid()` and `checkin_date <= current_date`. So this function must be `security definer` and must insert `(goal_id, user_id = the goal's owner, checkin_date = the missed day)`. Preserve the existing single-day grace rule and the `reason` handling from 0035, and keep the existing guard that a member cannot water their own streak.

Comment both with the counterfactual: without the ledger insert the watered streak would appear to recover and then vanish, because the number on screen would come from a column nothing else writes.

- [ ] **Step 1: Write the migration and verify by reading**

After writing, re-read the file against 0033/0025/0035 and confirm: every column referenced exists; both signatures and return types are unchanged; `security definer` is set with `search_path = public` as the other functions do; and no statement references an object before it exists.

- [ ] **Step 2: Verify nothing else regressed**

Run: `npm test && npx tsc --noEmit`
Expected: clean, 195 tests. This task touches no TypeScript.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0050_checkin_backed_rpcs.sql
git commit -m "Make step sync and streak-saving write real check-ins"
```

---

### Task 8: Streak-at-risk from the ledger

**Files:**
- Modify: `supabase/functions/check-streaks-at-risk/index.ts`

The function currently selects goals with `last_logged_date = yesterday and streak_count > 0` and pushes "Your N-day streak … is at risk". Both columns are dead for cadence goals, and the copy states a unit that is no longer universal.

**Narrow the feature deliberately.** Only a `daily` cadence can be "at risk today" — a 4×/week goal is not in danger on any particular day, and inventing a risk moment for it would be exactly the manufactured pressure this design removes. Say so in a comment.

- [ ] **Step 1: Rewrite the query**

Select active daily goals whose most recent `goal_checkins` row is dated yesterday and which have none for today. Read the file first and preserve everything around the query: the per-circle mute handling, the `deleted_at` filtering on members, the fail-closed behaviour on a mute-query error, and the per-circle try/catch. A previous review found real bugs in each of those; do not regress them.

- [ ] **Step 2: Fix the copy**

Replace `` `Your ${goal.streak_count}-day streak on "${goal.title}" is at risk` `` with copy that states no unit — for example `` `Your streak on "${goal.title}" is at risk - check in today!` ``. Comment that a streak is counted in the goal's own periods now.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npx eslint supabase/functions/check-streaks-at-risk/index.ts
git add supabase/functions/check-streaks-at-risk/index.ts
git commit -m "Find at-risk streaks in the ledger, and only for daily goals"
```

---

### Task 9: The daily digest counts check-ins

**Files:**
- Modify: `supabase/functions/daily-digest/digest.ts`
- Modify: `supabase/functions/daily-digest/index.ts`

The digest summarises a circle's day from `events` rows plus a `goals`/`last_logged_date` read. The events half still works; the `last_logged_date` half does not.

- [ ] **Step 1: Replace the activity read**

Wherever the function reads `goals.last_logged_date` to decide who was active, count distinct `user_id`s in `goal_checkins` for the digest window instead. The window is already half-open `[anchor-24h, anchor)` — keep it exactly, and keep `DIGEST_HOUR_UTC` / `DIGEST_MINUTE_UTC` matching the pg_cron schedule in migration 0040, which a previous review flagged as a pairing that must not drift.

- [ ] **Step 2: Keep the tests passing**

`supabase/functions/daily-digest/digest.test.ts` exists and runs under `npm test`. Update its fixtures to the new shape and keep every existing assertion about ordering and empty-day behaviour — the digest's "say nothing rather than something warm and false" rule is load-bearing.

- [ ] **Step 3: Verify and commit**

```bash
npm test && npx eslint supabase/functions/daily-digest
git add supabase/functions/daily-digest
git commit -m "Count the digest's activity from check-ins"
```

---

### Task 10: Buddy card, and the last naming violation

**Files:**
- Modify: `src/components/BuddyCard.tsx`

**Interfaces:**
- Consumes: `useMemberActivity` (Task 2), `isInGraceWindow` (Task 4).

- [ ] **Step 1: Source the grace window from the ledger**

`BuddyCard` finds a waterable goal with `isInGraceWindow(g.last_logged_date, Date.now())`. Feed it the buddy's `lastCheckinDate` from `useMemberActivity` instead, and pick the goal id the same way Task 4's caller does — the buddy's longest-streak goal.

- [ ] **Step 2: Fix the naming violation**

Line ~137 renders the user-visible copy **"Pick a buddy to keep each other on track."** The spec forbids that phrase app-wide: it is a judgement, and it is the exact wording this whole model was named away from. Replace it with **"Pick a buddy to keep each other going."**

- [ ] **Step 3: Verify the phrase is gone from the whole repo**

Run: `grep -rin "on track" src supabase --include=*.ts --include=*.tsx --include=*.sql`
Expected: only matches inside comments that explicitly forbid the phrase (there is one in `src/lib/showingUp.ts` and one in `src/lib/cadence.ts`). No user-visible string, no identifier.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test && npx eslint src/components/BuddyCard.tsx
git add src/components/BuddyCard.tsx
git commit -m "Water a buddy's streak from the ledger, and drop the last on-track copy"
```

---

### Task 11: Circle Ideas reads Areas, not the old pillars

**Files:**
- Modify: `src/hooks/useCircleAI.ts`

**Interfaces:**
- Consumes: `useMemberActivity` (Task 2); `useCircleAreas` from `src/hooks/useAreas.ts`.

`useCircleAI` builds its per-pillar strength from `.select('category, streak_count')` and sums `streak_count` per `category`. **Both halves are dead.** `category` is the old five-pillar column, superseded by `area_id`; `streak_count` is not written for a cadence goal. Left alone, every Area totals zero and the feature suggests a challenge based on noise — and `circlePrompts.ts` picks the *weakest* category, so it would recommend whichever one happens to sort first.

- [ ] **Step 1: Read what consumes it**

Read `src/hooks/useCircleAI.ts` and `src/lib/circlePrompts.ts` in full. `circlePrompts` is keyed by `CircleCategory`, which mirrors the five old pillars. Note which of the eight Areas have no prompt entry — `mind`, `career` and `community` will not.

- [ ] **Step 2: Sum per Area, from the ledger**

Replace the query with one that selects `area_id` alongside the goal fields, and total each Area's strength as the sum of its goals' ledger streaks (from `useMemberActivity`'s inputs, or by calling `streak` directly over `useGoalCheckins` data — either is fine, but do not reintroduce `streak_count`).

- [ ] **Step 3: Handle the Areas with no prompts**

`circlePrompts.ts` has no challenge copy for `mind`, `career` or `community`. Do **not** invent copy for them in this task — writing product voice for three new categories is its own piece of work. Instead, restrict the weakest/strongest selection to Areas that actually have prompts, and comment that the remaining three get copy in the taxonomy plan. Silently suggesting nothing is better than suggesting a challenge the catalogue cannot describe.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm test && npx eslint src/hooks/useCircleAI.ts
git add src/hooks/useCircleAI.ts
git commit -m "Base Circle Ideas on Areas and real streaks"
```

---

### Task 12: The last stale reads

**Files:**
- Modify: `src/components/garden/GardenHero.tsx`
- Modify: `src/screens/GoalsScreen.tsx`
- Modify: `src/screens/TodayScreen.tsx`

Found by auditing `grep -rln "streak_count\|last_logged_date" src supabase/functions` against the tasks above. Four reads no earlier task covers.

- [ ] **Step 1: `GardenHero.tsx:76` — who checked in today**

```ts
const loggedToday = new Set((goals ?? []).filter((g) => g.last_logged_date === today).map((g) => g.user_id));
```

Dead for every cadence commitment. Replace with the set of members whose `lastCheckinDate` from `useMemberActivity` equals today. The hero is the app's centrepiece; showing nobody as active is the loudest possible version of this whole plan's bug.

- [ ] **Step 2: `GoalsScreen.tsx:196-199` — the second streak number**

The card renders `goal.streak_count` as a badge, directly beside the ledger-derived streak in `GoalCadenceRow`. For a cadence commitment `streak_count` is 0 so the badge hides itself, but for a legacy goal both render and disagree. Delete the badge — `GoalCadenceRow` is the one place a streak is stated now. Remove any style keys and imports left orphaned; grep before deleting.

- [ ] **Step 3: `GoalsScreen.tsx:459` — `friendsCompletedToday`**

Built from `last_logged_date`, so it is now always 0 and the footer renders an empty `<Text>` whose `space-between` layout depends on an invisible element. Rebuild it from `useGoalCheckins`: the number of *other* members with a check-in today. Keep the existing copy and the "a goal reads as a shared effort, not a private task-manager row" intent from its comment.

- [ ] **Step 4: `TodayScreen.tsx:165` — the streak-milestone copy**

```ts
return `${name} hit a ${payload.streak_count ?? ''} day streak`.trim();
```

Two problems: it says **"day streak"**, which is false for any non-daily cadence, and the events carrying that payload are written by the legacy `log_goal_progress` path, which cadence commitments no longer use — so this line is both wrong and increasingly unreachable. Change the copy to state no unit: `` `${name} hit a ${payload.streak_count ?? ''} streak`.trim() ``. Do not remove the branch; legacy events already in the feed still render through it.

- [ ] **Step 5: Verify the audit is clean**

```bash
grep -rn "last_logged_date" src --include=*.tsx --include=*.ts | grep -v "types/models\|useLogGoalWithCelebration\|useSyncStepGoals\|useHealthSync"
```
Expected: no matches. The excluded files are the legacy numeric and Health Connect paths, which a later plan retires.

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit && npm test && npx eslint src/components/garden/GardenHero.tsx src/screens/GoalsScreen.tsx src/screens/TodayScreen.tsx
git add src/components/garden/GardenHero.tsx src/screens/GoalsScreen.tsx src/screens/TodayScreen.tsx
git commit -m "Clear the last reads of the columns nothing writes"
```

---

## Verification

```bash
npm test                                     # 195
npx tsc --noEmit                             # clean
npx eslint src supabase                      # clean
grep -rin "on track" src supabase --include=*.ts --include=*.tsx   # only the forbidding comments
```

Then, after the human applies migration 0050 and redeploys both edge functions, on a device:

1. Create a daily commitment and check in. The garden hero moves off `wilted` and circle health rises above 0%.
2. Check in three days running. The card shows 🔥3 and the member's plant advances a stage.
3. Skip two days. The member appears in Circle Today as `quiet`, and their buddy sees a waterable streak.
4. Water it. A `goal_checkins` row appears for the missed day and the streak survives.
5. Today's Mission lists the commitment with its cadence, and tapping it checks in.
6. A 4×/week goal never produces a streak-at-risk push, and a daily one does.

## Out of scope

- **The circle-first UI** — Area rollup on the Circle tab, the Area detail grid, Manage Areas, the new feed events and onboarding's default Areas. That is the next plan.
- **Taxonomy** — `suggestions.ts` is still catalogued against the five old pillars, `profiles.interests` still stores them, and `PillarIcons` still lacks Mind, Career and Community. Onboarding therefore still asks about five pillars while goals live in eight Areas. Cosmetic inconsistency, no wrong data; its own plan.
- **Dropping `goals.progress` / `target` / `streak_count` / `last_logged_date`.** They still back the Health Connect step path. Removing them is a cleanup plan once nothing reads them.
- **Task 10 of the write-path plan** — the full `status = 'active'` filter on `useGoals`, still gated on the human's blast-radius counts.
