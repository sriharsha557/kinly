# Home and Circle Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each tab one question it alone answers — Home "how am I doing today", Circle "how are we doing today, and is there anything I should do" — by rendering the garden once, moving circle identity and switching into a shared header control, and rebuilding the Circle tab as a people screen led by who needs something.

**Architecture:** All three "needs attention" signals are derived in one pure, unit-tested module (`src/lib/needsAttention.ts`), matching the pattern `moments.ts` / `gardenGrowth.ts` / `tiers.ts` already establish; the screens render what it returns and own no rules. One `CirclePicker` component serves both tabs' headers. One `useNudgeMember` hook closes the gap where a member row has no event for a nudge to attach to. No new queries and no schema change — every input already exists.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Supabase, React Query, `node:test` with `--experimental-strip-types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-home-circle-redesign-design.md` governs all behaviour here.
- **Governing principle:** Home answers *"How am I doing today?"*, Circle answers *"How are we doing today, and is there anything I should do?"* Anything that does not serve its screen's question does not belong on it.
- **No raw hex in components.** All colour comes from `useTheme()` tokens (`design/PRINCIPLES.md`).
- **One accent.** `colors.primary` marks interactive or selected elements only; resting UI is `surface` / `surfaceSubtle` / `textSecondary`.
- **13px type floor.** Nothing smaller, ever.
- **No emoji as icons.** Row markers use the app's own SVG components, which take a `color` prop and follow the accent. The existing `💧 Water` button *label* is established copy and stays.
- **Touch targets ≥48dp**, list rows ≥56dp (`design/REDESIGN.md` §2.3).
- **Display renames only.** The `Circle` route name in `MainTabParamList` must NOT change — deep links and navigation types depend on it.
- **The viewer never appears in Circle Today.** You cannot nudge yourself, and framing your own lapse as someone else's task is the shame mechanic `MoodCheckinCard` rules out.
- **Quiet threshold is `days > 3`**, exactly matching `useGarden.stageFor()`'s wilt threshold. The two must agree or a member shows wilted art while absent from Circle Today.
- **Verification commands:** `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three clean before a task is committed.
- **Test count starts at 35.**
- **Test imports use the explicit `.ts` extension** (`from './needsAttention.ts'`) — Node ESM performs no extension resolution. `allowImportingTsExtensions` is already set.
- **Every commit message body ends with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

### Task 1: `needsAttention` — the one place the three signals are defined

**Files:**
- Create: `src/lib/needsAttention.ts`
- Create: `src/lib/needsAttention.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type AttentionReason = 'streak_at_risk' | 'tough_day' | 'quiet'`, `interface AttentionRow { userId: string; name: string; reason: AttentionReason; detail: string; goalId?: string }`, `needsAttention(input: AttentionInput): AttentionRow[]`, and `isInGraceWindow(lastLoggedDate: string | null, now: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/needsAttention.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsAttention, isInGraceWindow } from './needsAttention.ts';

// A fixed "now" so expectations never drift with the day the suite runs.
const NOW = Date.parse('2026-08-01T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);

const ME = 'user-me';
const SARA = 'user-sara';
const RAVI = 'user-ravi';

const members = [
  { userId: ME, name: 'Me' },
  { userId: SARA, name: 'Sara' },
  { userId: RAVI, name: 'Ravi' },
];

function goal(user_id: string, last_logged_date: string | null, streak_count = 1, id = `g-${user_id}`) {
  return { id, user_id, last_logged_date, streak_count };
}

test('the grace window is exactly two days since the last log', () => {
  assert.equal(isInGraceWindow(daysAgo(1), NOW), false);
  assert.equal(isInGraceWindow(daysAgo(2), NOW), true);
  assert.equal(isInGraceWindow(daysAgo(3), NOW), false);
  assert.equal(isInGraceWindow(null, NOW), false);
});

test('a streak inside the grace window is at risk, and carries its goal id', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 12, 'goal-1')],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [
    { userId: SARA, name: 'Sara', reason: 'streak_at_risk', detail: '12-day streak ends today', goalId: 'goal-1' },
  ]);
});

test('with several at-risk goals the longest streak wins - most to lose', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 3, 'goal-short'), goal(SARA, daysAgo(2), 20, 'goal-long')],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].goalId, 'goal-long');
  assert.equal(rows[0].detail, '20-day streak ends today');
});

test('a tough-day check-in surfaces', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(0))],
    toughToday: [SARA],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, [{ userId: SARA, name: 'Sara', reason: 'tough_day', detail: 'had a tough day' }]);
});

test('quiet starts after more than three days, matching the wilt threshold', () => {
  const threeDays = needsAttention({
    members,
    goals: [goal(RAVI, daysAgo(3))],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(threeDays, []);

  const fourDays = needsAttention({
    members,
    goals: [goal(RAVI, daysAgo(4))],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(fourDays, [
    { userId: RAVI, name: 'Ravi', reason: 'quiet', detail: 'quiet for 4 days' },
  ]);
});

test('a member who has never logged anything is not quiet', () => {
  const rows = needsAttention({
    members,
    goals: [goal(RAVI, null)],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('a member with no goals at all is not quiet', () => {
  const rows = needsAttention({ members, goals: [], toughToday: [], viewerId: ME, now: NOW });
  assert.deepEqual(rows, []);
});

test('the viewer never appears, however bad their own week', () => {
  const rows = needsAttention({
    members,
    goals: [goal(ME, daysAgo(2), 9), goal(ME, daysAgo(30))],
    toughToday: [ME],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('one row per member, under the most urgent reason', () => {
  const rows = needsAttention({
    members,
    goals: [goal(SARA, daysAgo(2), 12)],
    toughToday: [SARA],
    viewerId: ME,
    now: NOW,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'streak_at_risk');
});

test('rows rank at-risk, then tough day, then quiet', () => {
  const rows = needsAttention({
    members,
    goals: [goal(RAVI, daysAgo(9)), goal(SARA, daysAgo(2), 12)],
    toughToday: [],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(
    rows.map((r) => r.reason),
    ['streak_at_risk', 'quiet'],
  );
});

test('a member in toughToday who is not in members is ignored', () => {
  const rows = needsAttention({
    members,
    goals: [],
    toughToday: ['user-ghost'],
    viewerId: ME,
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('an empty circle produces no rows', () => {
  assert.deepEqual(needsAttention({ members: [], goals: [], toughToday: [], viewerId: ME, now: NOW }), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './needsAttention.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/needsAttention.ts`:

```ts
// Who in the circle needs something from you today, and what you can do
// about it (docs/superpowers/specs/2026-08-01-home-circle-redesign-design.md).
//
// The single definition of all three signals. The Circle screen renders what
// this returns and owns no rules of its own, so "is Sara waterable" cannot
// have two different answers in two different components - which is exactly
// what happened before, with the grace-window rule inlined in BuddyCard.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export type AttentionReason = 'streak_at_risk' | 'tough_day' | 'quiet';

export interface AttentionInput {
  members: readonly { userId: string; name: string }[];
  goals: readonly { id: string; user_id: string; last_logged_date: string | null; streak_count: number }[];
  toughToday: readonly string[];
  viewerId: string;
  // Injected rather than read from Date.now() inside, so tests can pin a
  // date instead of computing expectations relative to the day they run.
  now: number;
}

export interface AttentionRow {
  userId: string;
  name: string;
  reason: AttentionReason;
  detail: string;
  // Only set for streak_at_risk - water_streak() needs the specific goal.
  goalId?: string;
}

const DAY_MS = 86_400_000;

function daysSince(isoDate: string, now: number): number {
  return Math.floor((now - new Date(isoDate).getTime()) / DAY_MS);
}

// The exact single-day grace window water_streak() enforces server-side.
// Mirrored here only to decide whether to offer the action at all - the RPC
// re-validates everything, so being slightly generous here is safe and being
// wrong here cannot corrupt a streak.
export function isInGraceWindow(lastLoggedDate: string | null, now: number): boolean {
  if (!lastLoggedDate) return false;
  return daysSince(lastLoggedDate, now) === 2;
}

// Ordered most urgent first: an at-risk streak expires today, while a tough
// day and a quiet stretch both keep. Index in this array is the rank.
const REASON_RANK: AttentionReason[] = ['streak_at_risk', 'tough_day', 'quiet'];

export function needsAttention(input: AttentionInput): AttentionRow[] {
  const { members, goals, toughToday, viewerId, now } = input;
  const tough = new Set(toughToday);
  const rows: AttentionRow[] = [];

  for (const member of members) {
    if (member.userId === viewerId) continue;

    const theirGoals = goals.filter((g) => g.user_id === member.userId);

    // Most to lose wins when several goals expire the same day.
    const atRisk = theirGoals
      .filter((g) => isInGraceWindow(g.last_logged_date, now))
      .sort((a, b) => b.streak_count - a.streak_count)[0];
    if (atRisk) {
      rows.push({
        userId: member.userId,
        name: member.name,
        reason: 'streak_at_risk',
        detail: `${atRisk.streak_count}-day streak ends today`,
        goalId: atRisk.id,
      });
      continue;
    }

    if (tough.has(member.userId)) {
      rows.push({ userId: member.userId, name: member.name, reason: 'tough_day', detail: 'had a tough day' });
      continue;
    }

    // A member who has never logged anything is not "quiet" - stageFor()
    // renders them wilted because it has no date to work from, but there is
    // nothing for them to have lapsed from, and prompting the circle to
    // chase someone who joined yesterday is hostile.
    const logged = theirGoals
      .map((g) => g.last_logged_date)
      .filter((d): d is string => d !== null);
    if (logged.length === 0) continue;

    const mostRecent = logged.reduce((latest, d) => (d > latest ? d : latest));
    const quietDays = daysSince(mostRecent, now);
    // > 3, not >= 3: this is exactly useGarden.stageFor()'s wilt threshold,
    // and the two must agree or a member shows wilted art in the Members
    // list while being absent from Circle Today.
    if (quietDays > 3) {
      rows.push({
        userId: member.userId,
        name: member.name,
        reason: 'quiet',
        detail: `quiet for ${quietDays} days`,
      });
    }
  }

  return rows.sort((a, b) => REASON_RANK.indexOf(a.reason) - REASON_RANK.indexOf(b.reason));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 12 new tests, 47 total, `# fail 0`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/needsAttention.ts src/lib/needsAttention.test.ts`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/lib/needsAttention.ts src/lib/needsAttention.test.ts
git commit -m "Add needsAttention, the one definition of who needs support today"
```

---

### Task 2: `BuddyCard` uses the shared grace-window rule

Deletes the second copy of the predicate so Buddy and Circle cannot disagree about who is waterable.

**Files:**
- Modify: `src/components/BuddyCard.tsx`

**Interfaces:**
- Consumes: `isInGraceWindow(lastLoggedDate: string | null, now: number): boolean` from `src/lib/needsAttention.ts` (Task 1)

- [ ] **Step 1: Delete the local predicate**

In `src/components/BuddyCard.tsx`, remove this block entirely:

```ts
// The exact single-day grace window water_streak() itself enforces
// server-side - mirrored here just to decide whether to show the button at
// all, not as the source of truth (the RPC re-validates everything).
function isInGraceWindow(lastLoggedDate: string | null): boolean {
  if (!lastLoggedDate) return false;
  const daysSince = Math.floor((Date.now() - new Date(lastLoggedDate).getTime()) / 86_400_000);
  return daysSince === 2;
}
```

- [ ] **Step 2: Import the shared one**

Add alongside the other imports:

```ts
import { isInGraceWindow } from '../lib/needsAttention';
```

- [ ] **Step 3: Pass `now` at the call site**

Replace:

```ts
  const waterableGoal = (goals ?? []).find(
    (g) => g.user_id === buddy?.buddy_id && isInGraceWindow(g.last_logged_date),
  );
```

with:

```ts
  // needsAttention owns this rule now, so the Circle tab and this card can
  // never disagree about whether a streak is still savable.
  const waterableGoal = (goals ?? []).find(
    (g) => g.user_id === buddy?.buddy_id && isInGraceWindow(g.last_logged_date, Date.now()),
  );
```

- [ ] **Step 4: Verify no copy remains**

Run: `grep -rn "function isInGraceWindow" src/`
Expected: exactly one hit, in `src/lib/needsAttention.ts`

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/components/BuddyCard.tsx`
Expected: 47 passing, then no output from either

- [ ] **Step 6: Commit**

```bash
git add src/components/BuddyCard.tsx
git commit -m "Point BuddyCard at the shared grace-window rule"
```

---

### Task 3: `useNudgeMember` — reaching someone who has no recent event

`useSendNudge` requires an `eventId`, because nudges hang off a row in `events`. A member row on the Circle tab has none, and a member who has gone quiet has by definition produced none recently. `useCheckInOnBuddy` already solved this for the buddy flow; this task generalises that one flow so both callers share it.

**Files:**
- Create: `src/hooks/useNudgeMember.ts`
- Modify: `src/hooks/useBuddy.ts`
- Modify: `src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: `generateNudgeMessage(kind: NudgeKind, name: string): Promise<string>` from `src/lib/nudgeMessage`
- Produces: `useNudgeMember(circleId: string | undefined)` returning a React Query mutation taking `{ targetId: string; targetName: string; fromUserId: string; kind: NudgeKind }`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useNudgeMember.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateNudgeMessage } from '../lib/nudgeMessage';
import type { NudgeKind } from '../types/models';

// Reaches out to a circle member who has no event to nudge.
//
// Nudges hang off a row in `events` (nudges.event_id), which is fine on
// Today where you nudge something you can see in the feed - but a member row
// on the Circle tab has no such row, and a member who has gone quiet has by
// definition produced none recently. So this inserts the event first: type
// 'buddy_checkin', whose user_id is the person being reached out to rather
// than the sender, exactly as useCheckInOnBuddy has always done.
//
// Migration 0041's RLS policy admits 'buddy_checkin' from any
// is_circle_member(circle_id), not only from the target's buddy, so this
// generalisation needs no schema change.
export function useNudgeMember(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetId,
      targetName,
      fromUserId,
      kind,
    }: {
      targetId: string;
      targetName: string;
      fromUserId: string;
      kind: NudgeKind;
    }) => {
      const message = await generateNudgeMessage(kind, targetName);

      const { data: event, error } = await supabase
        .from('events')
        .insert({
          circle_id: circleId,
          user_id: targetId,
          type: 'buddy_checkin',
          payload: { message },
        })
        .select()
        .single();
      if (error) throw error;

      const { error: nudgeError } = await supabase
        .from('nudges')
        .insert({ event_id: event.id, from_user_id: fromUserId, kind, message });
      if (nudgeError) throw nudgeError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
      queryClient.invalidateQueries({ queryKey: ['garden', circleId] });
    },
  });
}
```

- [ ] **Step 2: Refactor `useCheckInOnBuddy` onto it**

In `src/hooks/useBuddy.ts`, replace the whole `useCheckInOnBuddy` function with:

```ts
// Checking in on your buddy is just a nudge to someone with no event to
// attach it to - the same shape as reaching out from the Circle tab, so it
// shares useNudgeMember rather than keeping a second copy of both inserts.
export function useCheckInOnBuddy(circleId: string | undefined) {
  const nudgeMember = useNudgeMember(circleId);
  return useMutation({
    mutationFn: async ({
      buddyId,
      buddyName,
      fromUserId,
    }: {
      buddyId: string;
      buddyName: string;
      fromUserId: string;
    }) => {
      await nudgeMember.mutateAsync({
        targetId: buddyId,
        targetName: buddyName,
        fromUserId,
        kind: 'keep_going',
      });
    },
  });
}
```

Add to that file's imports:

```ts
import { useNudgeMember } from './useNudgeMember';
```

Then remove the now-unused imports from `src/hooks/useBuddy.ts`: `generateNudgeMessage` if nothing else in the file uses it. Run `npx eslint src/hooks/useBuddy.ts` to confirm — it reports unused imports.

- [ ] **Step 3: Generalise the feed copy**

In `src/screens/TodayScreen.tsx`'s `describeEvent`, replace:

```tsx
    case 'buddy_checkin':
      return `${name}'s buddy checked in on them`;
```

with:

```tsx
    case 'buddy_checkin':
      // Not only buddies send these any more - the Circle tab's member rows
      // use the same event type to reach anyone in the circle.
      return `${name} got a check-in from a circle-mate`;
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/hooks/useNudgeMember.ts src/hooks/useBuddy.ts src/screens/TodayScreen.tsx`
Expected: 47 passing, then no output from either

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useNudgeMember.ts src/hooks/useBuddy.ts src/screens/TodayScreen.tsx
git commit -m "Add useNudgeMember so any circle-mate can be reached without an event"
```

---

### Task 4: `CirclePicker` — one control, both headers

**Files:**
- Create: `src/components/CirclePicker.tsx`

**Interfaces:**
- Consumes: `useMyCircles(userId)` from `src/hooks/useCircles` returning `CircleWithMembership[]` (each with `id`, `name`, `membershipStatus`); `ActionSheet` from `src/components/ActionSheet` taking `{ title, message?, options: { label, destructive?, onPress }[], onCancel }`
- Produces: `<CirclePicker variant="chip" | "title" />`

- [ ] **Step 1: Write the component**

Create `src/components/CirclePicker.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { ActionSheet } from './ActionSheet';
import { useMyCircles } from '../hooks/useCircles';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';

// Which circle you are looking at, and how to change it - without leaving
// the screen you are on. Switching used to mean Home -> Circle -> pick ->
// back to Home, i.e. leaving the screen in order to change what it shows.
//
// One control, two sizes: a quiet chip above Home's greeting (context, not
// a headline - the greeting keeps that job) and the Circle tab's own title,
// where the circle's real name is more useful than the word "Circle" the
// tab bar already says.
export function CirclePicker({ variant }: { variant: 'chip' | 'title' }) {
  const userId = useAuthStore((state) => state.user?.id);
  const activeCircleId = useAuthStore((state) => state.activeCircleId);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const { data: circles } = useMyCircles(userId);
  const [picking, setPicking] = useState(false);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Pending members can't see anything circle-scoped yet, so switching to
  // one would land on an empty screen.
  const myCircles = (circles ?? []).filter((c) => c.membershipStatus === 'active');
  const active = myCircles.find((c) => c.id === activeCircleId);
  const isTitle = variant === 'title';

  if (!active) return null;

  return (
    <>
      <AnimatedPressable
        style={isTitle ? styles.titleRow : styles.chipRow}
        onPress={() => setPicking(true)}
        // A single circle has nothing to switch to, so the control stays
        // visible for identity but stops advertising an action.
        disabled={myCircles.length < 2}
        accessibilityRole="button"
        accessibilityLabel={`Active circle: ${active.name}. Switch circle.`}
      >
        <Text style={isTitle ? styles.titleText : styles.chipText} numberOfLines={1}>
          {active.name}
        </Text>
        {myCircles.length > 1 && (
          <Text style={isTitle ? styles.titleChevron : styles.chipChevron}>▾</Text>
        )}
      </AnimatedPressable>

      {picking && (
        <ActionSheet
          title="Switch circle"
          options={myCircles.map((circle) => ({
            label: circle.id === activeCircleId ? `${circle.name} · current` : circle.name,
            onPress: () => {
              setPicking(false);
              if (circle.id !== activeCircleId) setActiveCircleId(circle.id);
            },
          }))}
          onCancel={() => setPicking(false)}
        />
      )}
    </>
  );
}

function createStyles({ colors, radii, spacing }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      minHeight: 48,
      paddingRight: spacing.sm,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    chipChevron: { fontSize: 11, color: colors.textSecondary },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, flexShrink: 1 },
    titleText: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, flexShrink: 1 },
    titleChevron: { fontSize: 14, color: colors.textSecondary },
  });
}
```

`spacing` is a real key on the theme object (`src/theme/colors.ts`), so `spacing.sm` resolves — no fallback needed.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/CirclePicker.tsx`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/components/CirclePicker.tsx
git commit -m "Add CirclePicker so switching circles never leaves the screen"
```

---

### Task 5: Home — the circle chip and the shortcut rename

**Files:**
- Modify: `src/screens/TodayScreen.tsx`
- Modify: `src/components/QuickActionsRow.tsx`

**Interfaces:**
- Consumes: `<CirclePicker variant="chip" />` from Task 4

- [ ] **Step 1: Add the chip above the greeting**

In `src/screens/TodayScreen.tsx`, add the import alongside the other component imports:

```tsx
import { CirclePicker } from '../components/CirclePicker';
```

Then replace:

```tsx
        <View style={styles.greetingRow}>
```

with:

```tsx
        {/* Which circle the garden below belongs to. Above the greeting and
            deliberately quiet: it is context, not the screen's headline. */}
        <CirclePicker variant="chip" />
        <View style={styles.greetingRow}>
```

- [ ] **Step 2: Rename the shortcut**

In `src/components/QuickActionsRow.tsx`, replace:

```tsx
  { label: 'Check In', icon: CheckIcon, tab: 'Goals' },
```

with:

```tsx
  // "Check In" collided with the mood check-in directly above this row on
  // Home, and was ambiguous between mood, attendance, daily login and goal
  // progress. All three labels are verb phrases now.
  { label: 'Log Progress', icon: CheckIcon, tab: 'Goals' },
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/screens/TodayScreen.tsx src/components/QuickActionsRow.tsx`
Expected: 47 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git add src/screens/TodayScreen.tsx src/components/QuickActionsRow.tsx
git commit -m "Show the active circle on Home and rename Check In to Log Progress"
```

---

### Task 6: `CircleHealthCard` — how are we, before anything is asked of you

**Files:**
- Create: `src/components/CircleHealthCard.tsx`

**Interfaces:**
- Consumes: `useGardenState(circleId)` returning `{ members: { userId, name, stage, streak }[], health: number }`; `useTodayMoodCheckins(circleId)` returning `{ user_id, mood, tags, profiles }[]`; `GardenStageArt` taking `{ stage, size }`
- Produces: `<CircleHealthCard circleId={string} needsSupportCount={number} />`

- [ ] **Step 1: Write the component**

Create `src/components/CircleHealthCard.tsx`:

```tsx
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GardenStageArt } from './GardenStageArt';
import { useGardenState, type GardenStage } from '../hooks/useGarden';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { useTheme } from '../theme/ThemeProvider';

// The Circle tab's answer to "how are we?", given before the screen asks
// anything of you. Also the only place the garden's identity survives on
// this tab - the full hero lives on Home now, and rendering it twice was
// what made Circle read as a second dashboard.
//
// Health thresholds and vocabulary are design/REDESIGN.md §5.2's, reused
// rather than reinvented.
function healthLabel(health: number): { word: string; stage: GardenStage } {
  if (health >= 80) return { word: 'Thriving', stage: 'bloom' };
  if (health >= 40) return { word: 'Healthy', stage: 'tree' };
  if (health >= 1) return { word: 'Needs care', stage: 'wilted' };
  return { word: 'Just planted', stage: 'seed' };
}

export function CircleHealthCard({
  circleId,
  needsSupportCount,
}: {
  circleId: string;
  needsSupportCount: number;
}) {
  const { data: garden } = useGardenState(circleId);
  const { data: moods } = useTodayMoodCheckins(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const members = garden?.members ?? [];
  const { word, stage } = healthLabel(garden?.health ?? 0);
  const checkedIn = new Set((moods ?? []).map((m) => m.user_id)).size;
  const activeStreaks = members.filter((m) => m.streak > 0).length;

  // "1 needs support" is omitted entirely at zero rather than rendered as
  // "0 need support" - a good day should not be phrased as an absence.
  const facts = [
    `${checkedIn}/${members.length} checked in today`,
    `${activeStreaks} active ${activeStreaks === 1 ? 'streak' : 'streaks'}`,
    needsSupportCount > 0
      ? `${needsSupportCount} ${needsSupportCount === 1 ? 'person needs' : 'people need'} support`
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <View style={styles.card}>
      <View style={styles.headline}>
        <GardenStageArt stage={stage} size={36} />
        <Text style={styles.word}>{word}</Text>
      </View>
      {facts.map((line) => (
        <Text key={line} style={styles.fact}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function createStyles({ colors, cardShell }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    // cardShell is the shared flat card treatment (1px border hairline, no
    // shadow) - design/PRINCIPLES.md's "Shape & space" rule, spread rather
    // than hand-rolled so this card cannot drift from every other one.
    card: { ...cardShell, padding: 20, gap: 4, marginBottom: 16 },
    headline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    word: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    fact: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/CircleHealthCard.tsx`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/components/CircleHealthCard.tsx
git commit -m "Add CircleHealthCard, the Circle tab's answer to how are we"
```

---

### Task 7: `CircleTodaySection` — who needs you, and what you can do

Split from the screen itself so the screen stays readable and this piece can be reasoned about on its own.

**Files:**
- Create: `src/components/CircleTodaySection.tsx`

**Interfaces:**
- Consumes: `AttentionRow` and `needsAttention` from `src/lib/needsAttention` (Task 1); `useNudgeMember` from Task 3; `useWaterStreak(circleId).mutateAsync({ goalId, reason? })`; `useGardenState`, `useGoals`, `useTodayMoodCheckins`
- Produces: `<CircleTodaySection circleId={string} userId={string} rows={AttentionRow[]} />`

- [ ] **Step 1: Write the component**

Create `src/components/CircleTodaySection.tsx`:

```tsx
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PillButton } from './PillButton';
import { useWaterStreak } from '../hooks/useStreakSaves';
import { useNudgeMember } from '../hooks/useNudgeMember';
import { useTheme } from '../theme/ThemeProvider';
import type { AttentionRow } from '../lib/needsAttention';
import SproutIcon from '../../assets/icons/feed/sprout.svg';

// Every row carries exactly one action, chosen by why the person is here.
const ACTION_LABEL: Record<AttentionRow['reason'], string> = {
  streak_at_risk: '💧 Water',
  tough_day: 'Check in',
  quiet: 'Cheer',
};

export function CircleTodaySection({
  circleId,
  userId,
  rows,
}: {
  circleId: string;
  userId: string;
  rows: AttentionRow[];
}) {
  const waterStreak = useWaterStreak(circleId);
  const nudgeMember = useNudgeMember(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  async function handleAction(row: AttentionRow) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (row.reason === 'streak_at_risk' && row.goalId) {
        await waterStreak.mutateAsync({ goalId: row.goalId });
        return;
      }
      await nudgeMember.mutateAsync({
        targetId: row.userId,
        targetName: row.name,
        fromUserId: userId,
        // A tough day wants encouragement to keep going; a quiet stretch
        // wants a cheer. Both map onto existing nudge kinds.
        kind: row.reason === 'tough_day' ? 'keep_going' : 'cheer',
      });
    } catch (err) {
      Alert.alert('Could not send that', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Circle Today</Text>

      {rows.length === 0 ? (
        // A good day is phrased as good news, not as an empty list. A
        // section that silently disappears also leaves you unsure whether
        // it checked at all - the confirmation is the point.
        <View style={styles.empty}>
          <SproutIcon width={22} height={22} color={theme.colors.primary} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>Your circle is doing well today.</Text>
            <Text style={styles.emptyBody}>Everyone checked in and no one needs support.</Text>
          </View>
        </View>
      ) : (
        rows.map((row) => (
          <View key={`${row.userId}-${row.reason}`} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.detail}>{row.detail}</Text>
            </View>
            <PillButton
              label={ACTION_LABEL[row.reason]}
              onPress={() => handleAction(row)}
              loading={waterStreak.isPending || nudgeMember.isPending}
              style={styles.action}
            />
          </View>
        ))
      )}
    </View>
  );
}

function createStyles({ colors, radii }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    heading: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowCopy: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    detail: { fontSize: 14, color: colors.textSecondary },
    // Overrides PillButton's full-width default padding so the action sits
    // as a compact trailing control rather than dominating the row.
    action: { paddingVertical: 12, paddingHorizontal: 18 },
    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: radii.card,
      padding: 16,
    },
    emptyCopy: { flex: 1, gap: 2 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    emptyBody: { fontSize: 14, color: colors.textSecondary },
  });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/CircleTodaySection.tsx`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/components/CircleTodaySection.tsx
git commit -m "Add Circle Today, with a positive empty state"
```

---

### Task 8: `CircleMembersSection` — everyone else

**Files:**
- Create: `src/components/CircleMembersSection.tsx`

**Interfaces:**
- Consumes: `useGardenState`, `useTodayMoodCheckins`, `useNudgeMember` (Task 3), `GardenStageArt`
- Produces: `<CircleMembersSection circleId={string} userId={string} excludeUserIds={string[]} />`

- [ ] **Step 1: Write the component**

Create `src/components/CircleMembersSection.tsx`:

```tsx
import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PillButton } from './PillButton';
import { GardenStageArt } from './GardenStageArt';
import { useGardenState } from '../hooks/useGarden';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { useNudgeMember } from '../hooks/useNudgeMember';
import { useTheme } from '../theme/ThemeProvider';
import type { MoodValue } from '../types/models';

const MOOD_WORD: Record<MoodValue, string> = {
  great: 'Great',
  okay: 'Okay',
  tough: 'Tough',
};

// Everyone not already shown in Circle Today, including you. Replaces the
// garden's plant row: the same per-member state, but as labelled rows with
// visible actions rather than 56dp plants you have to discover are tappable.
export function CircleMembersSection({
  circleId,
  userId,
  excludeUserIds,
}: {
  circleId: string;
  userId: string;
  excludeUserIds: string[];
}) {
  const { data: garden } = useGardenState(circleId);
  const { data: moods } = useTodayMoodCheckins(circleId);
  const nudgeMember = useNudgeMember(circleId);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const excluded = new Set(excludeUserIds);
  const members = (garden?.members ?? []).filter((m) => !excluded.has(m.userId));
  const moodByUser = new Map((moods ?? []).map((m) => [m.user_id, m.mood as MoodValue]));

  async function handleCheer(targetId: string, targetName: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await nudgeMember.mutateAsync({ targetId, targetName, fromUserId: userId, kind: 'cheer' });
    } catch (err) {
      Alert.alert('Could not send that', err instanceof Error ? err.message : 'Please try again.');
    }
  }

  if (members.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Members</Text>
      {members.map((member) => {
        const mood = moodByUser.get(member.userId);
        const isMe = member.userId === userId;
        const detail = [
          member.streak > 0 ? `${member.streak}-day streak` : 'no streak yet',
          mood ? MOOD_WORD[mood] : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <View key={member.userId} style={styles.row}>
            <GardenStageArt stage={member.stage} size={28} />
            <View style={styles.rowCopy}>
              <Text style={styles.name}>{isMe ? 'You' : member.name}</Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>
            {/* Outline, not solid: Circle Today's actions are the urgent
                ones, and if every row shouts equally none of them does. */}
            {!isMe && (
              <PillButton
                label="Cheer"
                variant="outline"
                onPress={() => handleCheer(member.userId, member.name)}
                style={styles.action}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles({ colors }: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    heading: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowCopy: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    detail: { fontSize: 14, color: colors.textSecondary },
    action: { paddingVertical: 12, paddingHorizontal: 18 },
  });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/CircleMembersSection.tsx`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/components/CircleMembersSection.tsx
git commit -m "Add the Circle members list, replacing the garden's plant row"
```

---

### Task 9: Rebuild the Circle screen

**Files:**
- Modify: `src/screens/CircleScreen.tsx`

**Interfaces:**
- Consumes: `CirclePicker` (Task 4), `CircleHealthCard` (Task 6), `CircleTodaySection` (Task 7), `CircleMembersSection` (Task 8), `needsAttention` (Task 1)

- [ ] **Step 1: Replace the imports**

In `src/screens/CircleScreen.tsx`, remove the `GardenHero` import and add:

```tsx
import { CirclePicker } from '../components/CirclePicker';
import { CircleHealthCard } from '../components/CircleHealthCard';
import { CircleTodaySection } from '../components/CircleTodaySection';
import { CircleMembersSection } from '../components/CircleMembersSection';
import { useGardenState } from '../hooks/useGarden';
import { useGoals } from '../hooks/useGoals';
import { useTodayMoodCheckins } from '../hooks/useMoodCheckins';
import { needsAttention } from '../lib/needsAttention';
```

- [ ] **Step 2: Delete `CircleSwitcher`**

Remove the entire `function CircleSwitcher({ activeCircleId, onSwitch }: ...) { ... }` component from the file, along with any styles used only by it (`circleRow`, `circleRowActive`, `circleRowActiveTag`, `switcher` and similar — check each is unreferenced with `grep` before deleting).

Also remove the now-unused `useMyCircles` import and the `setActiveCircleId` binding if nothing else in the file uses them. `npx eslint` reports both.

- [ ] **Step 3: Derive the attention rows**

Inside the `CircleScreen` component body, after the existing hook calls:

```tsx
  const { data: garden } = useGardenState(circleId ?? undefined);
  const { data: goals } = useGoals(circleId ?? undefined);
  const { data: moods } = useTodayMoodCheckins(circleId ?? undefined);

  // The screen owns no rules - needsAttention is the single definition of
  // all three signals, so this cannot drift from what BuddyCard believes.
  const attentionRows = useMemo(
    () =>
      userId
        ? needsAttention({
            members: garden?.members ?? [],
            goals: goals ?? [],
            toughToday: (moods ?? []).filter((m) => m.mood === 'tough').map((m) => m.user_id),
            viewerId: userId,
            now: Date.now(),
          })
        : [],
    [garden, goals, moods, userId],
  );
```

Ensure `useMemo` is imported from `react` in this file — add it to the existing import if absent.

- [ ] **Step 4: Replace the screen body**

Replace everything from `<View style={styles.header}>` through the closing `</Reveal>` of the `ChallengesCard` block with:

```tsx
        <View style={styles.header}>
          <CirclePicker variant="title" />
          <TouchableOpacity style={styles.settingsRow} onPress={() => navigation.navigate('CircleSettings')}>
            <SettingsIcon width={15} height={15} color={theme.colors.textSecondary} />
            <Text style={styles.settingsLink}>Settings</Text>
          </TouchableOpacity>
        </View>

        {circleId && (
          <Reveal index={0}>
            <CircleHealthCard circleId={circleId} needsSupportCount={attentionRows.length} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={1}>
            <CircleTodaySection circleId={circleId} userId={userId} rows={attentionRows} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={2}>
            <CircleMembersSection
              circleId={circleId}
              userId={userId}
              excludeUserIds={attentionRows.map((r) => r.userId)}
            />
          </Reveal>
        )}
        {/* Challenges above Buddy: challenges are collective, a buddy is a
            pairing, and the collective belongs higher on the screen that
            answers "how are we". */}
        {userId && circleId && (
          <Reveal index={3}>
            <ChallengesCard circleId={circleId} userId={userId} />
          </Reveal>
        )}
        {userId && circleId && (
          <Reveal index={4}>
            <BuddyCard circleId={circleId} userId={userId} />
          </Reveal>
        )}
```

The `DisclosureSection` block below it is unchanged and stays last.

- [ ] **Step 5: Verify the route name is untouched**

Run: `grep -rn "'Circle'" src/navigation/ src/components/QuickActionsRow.tsx`
Expected: the `MainTabParamList` entry, the `ICONS` map key and `QuickActionsRow`'s `tab: 'Circle'` all still present and unchanged.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/screens/CircleScreen.tsx`
Expected: 47 passing, then no output from either

- [ ] **Step 7: Commit**

```bash
git add src/screens/CircleScreen.tsx
git commit -m "Rebuild Circle as a people screen led by who needs something"
```

---

### Task 10: Retire `GardenHero`'s tend variant

Nothing renders it after Task 9. Leaving it invites its reuse and keeps a plant-tap interaction that the member rows now do better.

**Files:**
- Modify: `src/components/GardenHero.tsx`

- [ ] **Step 1: Confirm nothing uses it**

Run: `grep -rn "variant=\"tend\"\|variant={'tend'}" src/`
Expected: no output. If anything is found, stop — Task 9 is incomplete.

- [ ] **Step 2: Remove the prop and its branches**

In `src/components/GardenHero.tsx`:

- Change the signature from `export function GardenHero({ circleId, variant }: { circleId: string; variant: 'overview' | 'tend' })` to `export function GardenHero({ circleId }: { circleId: string })`.
- Delete the `tending` state, the `tendOptions` function, and the `ActionSheet` block that renders when `tending` is set.
- Replace `style={[styles.hero, variant === 'tend' && styles.heroTend]}` with `style={styles.hero}` and delete the `heroTend` style.
- Replace `onPress={variant === 'tend' ? () => setTending(member) : undefined}` with `onPress={undefined}` — or drop the prop from that element entirely.
- Replace the `{variant === 'overview' ? (...) : (...)}` conditional with just its `overview` branch.
- Remove imports left unused by the above (`ActionSheet`, `ActionSheetOption`, `useState` if nothing else needs it). `npx eslint` reports them.

- [ ] **Step 3: Update the call site**

In `src/screens/TodayScreen.tsx`, replace:

```tsx
        {circleId && <GardenHero circleId={circleId} variant="overview" />}
```

with:

```tsx
        {circleId && <GardenHero circleId={circleId} />}
```

- [ ] **Step 4: Update the file's header comment**

Replace the comment that reads `// (variant="overview", Today) and GardenCard (variant="tend", Circle).` with:

```tsx
// Today's garden. The Circle tab used to render this same component in a
// "tend" variant, which made that screen a second dashboard and put the
// water/cheer actions behind tapping a 56dp plant; those actions live in
// CircleTodaySection's labelled rows now, and this has one form again.
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/components/GardenHero.tsx src/screens/TodayScreen.tsx`
Expected: 47 passing, then no output from either

- [ ] **Step 6: Commit**

```bash
git add src/components/GardenHero.tsx src/screens/TodayScreen.tsx
git commit -m "Retire GardenHero's tend variant; the garden renders once"
```

---

### Task 11: Verify and document

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run everything**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# pass 47`, `# fail 0`, then no output from either.

- [ ] **Step 2: Verify the garden renders once**

Run: `grep -rn "<GardenHero" src/`
Expected: exactly one hit, in `src/screens/TodayScreen.tsx`.

- [ ] **Step 3: Verify on a device**

Publish to preview and check on a real phone:

```bash
npx eas-cli update --channel preview --message "Home and Circle redesign" --non-interactive
```

Confirm, in order:
1. Home shows the active circle's name above the greeting.
2. Tapping it opens a switcher; picking another circle updates Home's garden and feed **without leaving Home**. (With only one circle, the chip shows the name and no chevron.)
3. The middle shortcut reads **Log Progress** and still lands on Goals.
4. The Circle tab's title is the circle's name, and switching from there works too.
5. Circle shows the health card, then **Circle Today**, then **Members**, then Challenges, then Buddy, then the disclosure.
6. A member whose streak is in its grace window appears under Circle Today with **💧 Water**; tapping it saves the streak and the row disappears on refresh.
7. A member who checked in `tough` today appears with **Check in**; tapping it sends one push to them.
8. You never appear in Circle Today.
9. With nobody needing anything, Circle Today reads *"Your circle is doing well today."*
10. The garden appears on Home only.

- [ ] **Step 4: Document it**

Add to `ARCHITECTURE.md`, directly after the "Notification tiering and the daily digest" bullet:

```markdown
- **Home and Circle split** (docs/superpowers/specs/2026-08-01-home-circle-redesign-design.md): each tab now answers one question — Home *"how am I doing today"*, Circle *"how are we doing today, and is there anything I should do"*. The garden renders **once**, on Home; `GardenHero`'s `tend` variant and its plant-tap popover are gone, and the water/cheer actions it hid behind tapping a 56dp plant are labelled rows in `CircleTodaySection` instead. `CirclePicker` ([src/components/CirclePicker.tsx](src/components/CirclePicker.tsx)) puts the active circle's name in both tabs' headers — a quiet chip above Home's greeting, the screen title on Circle — so switching no longer means Home → Circle → pick → back to Home; it replaces the deleted `CircleSwitcher` chip row. `needsAttention` ([src/lib/needsAttention.ts](src/lib/needsAttention.ts)) is the single definition of all three "needs support" signals — at-risk streak (the `water_streak` grace window, `last_logged_date` exactly 2 days ago), tough-day check-in, and quiet (`days > 3`, exactly `useGarden.stageFor()`'s wilt threshold so the Members list's art and Circle Today's contents cannot disagree). The grace-window predicate moved out of `BuddyCard`, which had its own copy. A member who has never logged anything is deliberately never "quiet": `stageFor()` calls them wilted for want of a date, but there is nothing to have lapsed from. The viewer is excluded entirely — you cannot nudge yourself, and framing your own lapse as someone else's task is the shame mechanic `MoodCheckinCard` rules out. `useNudgeMember` ([src/hooks/useNudgeMember.ts](src/hooks/useNudgeMember.ts)) exists because `nudges.event_id` requires an event and a quiet member has produced none: it inserts a `buddy_checkin` event about the target first, generalising what `useCheckInOnBuddy` always did (which now calls it), permitted by migration `0041`'s policy admitting that type from any circle member. Home's `Check In` shortcut is `Log Progress` — the old label collided with the mood check-in directly above it.
```

- [ ] **Step 5: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "Document the Home and Circle split"
```

---

## What this plan deliberately does not do

- **Moments on the Circle tab.** The feed lives on Home; putting it on both re-creates the duplication this removes, and would push Challenges and Buddy below the fold.
- **Renaming the `Circle` route.** Display changes only — `MainTabParamList` and every `navigate('Circle')` call are untouched.
- **Reordering Home.** Beyond the chip and the one relabelled shortcut, Home's hierarchy is unchanged.
- **Per-category filtering of the daily digest.** Unrelated to these screens; noted in the notifications plan.
