# Moments Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the in-app awareness layer — the Moments feed, unread state, and restructured notification settings — so that quieting push notifications (Plan 2) never makes circle activity invisible.

**Architecture:** Adds one nullable column (`circle_members.last_read_events_at`) written through a `SECURITY DEFINER` RPC, a pure unread-counting function covered by unit tests, and UI changes across three screens. No push behaviour changes in this plan — that is Plan 2. This plan ships safely on its own via an EAS OTA update plus one migration.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Supabase (Postgres + RLS), React Query, `node:test` with `--experimental-strip-types` for unit tests.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-31-notifications-design.md` governs all behaviour here.
- **No raw hex in components.** All colour comes from `useTheme()` tokens (`design/PRINCIPLES.md`).
- **Accent is for interactive elements only.** Resting UI uses `surfaceSubtle` / `textSecondary`.
- **Display renames only.** Route names in `MainTabParamList` (`Connection`) must NOT change — deep links and navigation types depend on them.
- **Unread excludes your own events.** Your own actions never mark your feed unread.
- **Read stamping happens on screen focus**, not on scroll.
- **Migrations are sequential.** The next number is `0038`.
- **Node version:** 22.16.0 local. Test runner verified working with `node --experimental-strip-types --test "src/**/*.test.ts"`.
- **Test imports use the explicit `.ts` extension** (`from './moments.ts'`) because Node ESM performs no extension resolution. This requires `allowImportingTsExtensions` in `tsconfig.json`, added in Task 1 — without it `npx tsc --noEmit` fails with `TS5097`.
- **Verification commands** used throughout: `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three must be clean before a task is committed.
- **Deployment:** migrations and RPCs are applied by hand in the Supabase Dashboard (SQL Editor). This repo has no migration CLI step.

---

### Task 1: Unread counting logic + test harness

Establishes the project's first unit test. The function is deliberately self-contained (no imports) so type-stripping needs no module resolution.

**Files:**
- Create: `src/lib/moments.ts`
- Create: `src/lib/moments.test.ts`
- Modify: `package.json` (add `test` script)
- Modify: `tsconfig.json` (add `allowImportingTsExtensions`)

**Interfaces:**
- Consumes: nothing
- Produces: `countUnreadEvents(events: readonly UnreadCandidate[], lastReadAt: string | null, viewerId: string): number` and `interface UnreadCandidate { created_at: string; user_id: string }`

- [ ] **Step 1: Add the test script to `package.json`**

In the `"scripts"` block, add the `test` entry (keep the existing entries):

```json
"test": "node --experimental-strip-types --test \"src/**/*.test.ts\""
```

- [ ] **Step 1b: Allow `.ts` extensions in imports**

Node's type stripping requires the explicit `./moments.ts` extension in the
test's import (Node ESM does no extension resolution). TypeScript rejects that
by default with `TS5097`, and `src/**` is inside the typecheck, so
`npx tsc --noEmit` would fail from Task 3 onward without this. Verified: adding
the flag makes the probe compile clean, and it is legal here because
`expo/tsconfig.base` already sets `noEmit: true`.

Replace `tsconfig.json` with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "allowImportingTsExtensions": true
  },
  "exclude": ["node_modules", "supabase/functions"]
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/moments.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countUnreadEvents } from './moments.ts';

const ME = 'user-me';
const FRIEND = 'user-friend';

test('counts a friend event newer than the stamp', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 1);
});

test('ignores your own events', () => {
  const events = [{ created_at: '2026-07-31T11:00:00Z', user_id: ME }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('ignores events older than the stamp', () => {
  const events = [{ created_at: '2026-07-31T08:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('treats a null stamp as never read, so all friend events count', () => {
  const events = [
    { created_at: '2020-01-01T00:00:00Z', user_id: FRIEND },
    { created_at: '2026-07-31T11:00:00Z', user_id: FRIEND },
    { created_at: '2026-07-31T11:00:00Z', user_id: ME },
  ];
  assert.equal(countUnreadEvents(events, null, ME), 2);
});

test('an event exactly at the stamp is already read', () => {
  const events = [{ created_at: '2026-07-31T09:00:00Z', user_id: FRIEND }];
  assert.equal(countUnreadEvents(events, '2026-07-31T09:00:00Z', ME), 0);
});

test('returns 0 for an empty feed', () => {
  assert.equal(countUnreadEvents([], null, ME), 0);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './moments.ts'`

- [ ] **Step 4: Write the implementation**

Create `src/lib/moments.ts`:

```ts
// Unread bookkeeping for the Moments feed (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). Deliberately dependency-free: it is
// imported by the app under Metro and by node:test under
// --experimental-strip-types, and cross-file type imports would need module
// resolution the stripper does not perform.

export interface UnreadCandidate {
  created_at: string;
  user_id: string;
}

// Your own actions never mark your own feed unread, so viewerId is excluded.
// A null stamp means "never read", which makes every other member's event
// unread - correct for a brand-new member.
// created_at values are ISO-8601 UTC strings from Postgres, so lexicographic
// comparison is chronological; an event exactly at the stamp counts as read.
export function countUnreadEvents(
  events: readonly UnreadCandidate[],
  lastReadAt: string | null,
  viewerId: string,
): number {
  return events.filter(
    (event) => event.user_id !== viewerId && (lastReadAt === null || event.created_at > lastReadAt),
  ).length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — `# pass 6`, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json src/lib/moments.ts src/lib/moments.test.ts
git commit -m "Add unread counting for Moments feed, with first unit tests"
```

---

### Task 2: Migration — read stamp column and RPC

**Files:**
- Create: `supabase/migrations/0038_moments_read_state.sql`

**Interfaces:**
- Produces: column `circle_members.last_read_events_at timestamptz` (nullable) and RPC `mark_moments_read(p_circle_id uuid) returns void`

**Why an RPC rather than an RLS policy:** the only UPDATE policy on `circle_members` is `0003_circle_member_role_update.sql`, which restricts updates to owners and admins — a plain member's update silently affects zero rows. Adding a "members update their own row" policy would be a privilege escalation, because RLS grants access to the *row*, not to specific columns: a member could set their own `role` to `owner`. A `SECURITY DEFINER` function that writes exactly one column is the safe equivalent, and matches `submit_mood_checkin` / `approve_member`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0038_moments_read_state.sql`:

```sql
-- Unread state for the Moments feed (docs/superpowers/specs/2026-07-31-
-- notifications-design.md). Null means "never read", so a new member sees
-- everything as new. Keyed per (user, circle) - circle_members is already
-- keyed that way, so no new table is needed.
alter table circle_members add column if not exists last_read_events_at timestamptz;

-- Members must be able to stamp their own read state, but the only UPDATE
-- policy on circle_members (0003) is owner/admin-only. A permissive
-- "update your own row" policy is not an option: RLS grants the whole row,
-- so a member could also set role = 'owner'. This security-definer function
-- writes exactly one column for exactly the calling user instead.
create or replace function mark_moments_read(p_circle_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update circle_members
  set last_read_events_at = now()
  where circle_id = p_circle_id
    and user_id = auth.uid()
    and status = 'active';
$$;

revoke all on function mark_moments_read(uuid) from public;
grant execute on function mark_moments_read(uuid) to authenticated;
```

- [ ] **Step 2: Apply it**

Paste the file contents into Supabase Dashboard → SQL Editor → Run.
Expected: `Success. No rows returned`

- [ ] **Step 3: Verify the column and function exist**

Run in the SQL Editor:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'circle_members' and column_name = 'last_read_events_at';

select proname, prosecdef from pg_proc where proname = 'mark_moments_read';
```

Expected: one row `last_read_events_at | timestamp with time zone | YES`, and one row `mark_moments_read | t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0038_moments_read_state.sql
git commit -m "Add Moments read-state column and mark_moments_read RPC"
```

---

### Task 3: `useMomentsUnread` hook

**Files:**
- Create: `src/hooks/useMomentsUnread.ts`

**Interfaces:**
- Consumes: `countUnreadEvents` from `src/lib/moments.ts`; `supabase` from `src/lib/supabase.ts`
- Produces: `useMomentsUnread(circleId: string | undefined, userId: string | undefined)` returning `{ unreadCount: number; lastReadAt: string | null }`, and `useMarkMomentsRead(circleId: string | undefined, userId: string | undefined)` returning a React Query mutation whose `mutate()` takes no arguments

- [ ] **Step 1: Write the hook**

Create `src/hooks/useMomentsUnread.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { countUnreadEvents } from '../lib/moments';

// Reads the viewer's own membership row for its read stamp, then counts how
// many of the circle's recent events postdate it. Deliberately a separate
// query from useEvents: that one is paginated and infinite, and the badge
// needs a stable count independent of how far the user has scrolled.
const UNREAD_WINDOW = 100;

export function useMomentsUnread(circleId: string | undefined, userId: string | undefined) {
  const query = useQuery({
    queryKey: ['momentsUnread', circleId, userId],
    enabled: !!circleId && !!userId,
    queryFn: async (): Promise<{ unreadCount: number; lastReadAt: string | null }> => {
      const { data: membership, error: membershipError } = await supabase
        .from('circle_members')
        .select('last_read_events_at')
        .eq('circle_id', circleId as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      if (membershipError) throw membershipError;

      const lastReadAt = (membership?.last_read_events_at as string | null) ?? null;

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('created_at, user_id')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false })
        .limit(UNREAD_WINDOW);
      if (eventsError) throw eventsError;

      return {
        unreadCount: countUnreadEvents(events ?? [], lastReadAt, userId as string),
        lastReadAt,
      };
    },
  });

  return {
    unreadCount: query.data?.unreadCount ?? 0,
    lastReadAt: query.data?.lastReadAt ?? null,
  };
}

export function useMarkMomentsRead(circleId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!circleId) return;
      const { error } = await supabase.rpc('mark_moments_read', { p_circle_id: circleId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['momentsUnread', circleId, userId] }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMomentsUnread.ts
git commit -m "Add useMomentsUnread hook backed by mark_moments_read RPC"
```

---

### Task 4: Feed becomes "Moments", with a New divider and read stamping

**Files:**
- Modify: `src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: `useMomentsUnread`, `useMarkMomentsRead` from Task 3

- [ ] **Step 1: Add the imports**

In `src/screens/TodayScreen.tsx`, alongside the other hook imports:

```tsx
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useMomentsUnread, useMarkMomentsRead } from '../hooks/useMomentsUnread';
```

Add `useCallback` to the existing `react` import rather than duplicating it if one is already present.

- [ ] **Step 2: Wire the hooks into `TodayScreen`**

Inside the `TodayScreen` component body, after the existing `useEvents(...)` call:

```tsx
  const { lastReadAt } = useMomentsUnread(circleId ?? undefined, userId);
  const markRead = useMarkMomentsRead(circleId ?? undefined, userId);

  // Arriving at the screen counts as reading, per the spec - not scrolling.
  // The stamp captured on focus is held in lastReadAtOnEntry so the "New"
  // divider stays put while you read, instead of vanishing the instant the
  // stamp updates.
  const [lastReadAtOnEntry, setLastReadAtOnEntry] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setLastReadAtOnEntry(lastReadAt);
      markRead.mutate();
      // markRead is a stable React Query mutation object; including it would
      // re-fire the effect on every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastReadAt]),
  );
```

- [ ] **Step 3: Rename the section heading**

Replace:

```tsx
        <Text style={styles.sectionTitle}>Circle Activity</Text>
```

with:

```tsx
        <Text style={styles.sectionTitle}>Moments</Text>
```

- [ ] **Step 4: Render the New divider**

Replace the events `.map(...)` block with this version, which inserts a single divider above the first unread event:

```tsx
            {events.map((event, index) => {
              const label = dayLabel(event.created_at);
              const showHeader = label !== lastLabel;
              lastLabel = label;
              const isUnread =
                event.user_id !== userId &&
                (lastReadAtOnEntry === null || event.created_at > lastReadAtOnEntry);
              const previous = index > 0 ? events[index - 1] : null;
              const previousUnread =
                previous !== null &&
                previous.user_id !== userId &&
                (lastReadAtOnEntry === null || previous.created_at > lastReadAtOnEntry);
              const showNewDivider = isUnread && !previousUnread;
              return (
                <View key={event.id}>
                  {showNewDivider && <Text style={styles.newDivider}>New</Text>}
                  {showHeader && <Text style={styles.dayHeader}>{label}</Text>}
                  {userId && circleId && <EventRow event={event} circleId={circleId} userId={userId} />}
                </View>
              );
            })}
```

- [ ] **Step 5: Add the divider style**

In `createStyles`, beside `dayHeader`:

```tsx
    newDivider: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.primary,
      marginTop: 12,
      marginBottom: 2,
    },
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/screens/TodayScreen.tsx`
Expected: no output from either

- [ ] **Step 7: Commit**

```bash
git add src/screens/TodayScreen.tsx
git commit -m "Rename Circle Activity to Moments, add New divider and read stamping"
```

---

### Task 5: Unread dot on the Home tab

**Files:**
- Modify: `src/navigation/MainTabs.tsx`

**Interfaces:**
- Consumes: `useMomentsUnread` from Task 3

- [ ] **Step 1: Add imports**

```tsx
import { View } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { useMomentsUnread } from '../hooks/useMomentsUnread';
```

- [ ] **Step 2: Extend `TabIcon` to render a dot**

Replace the `TabIcon` component with:

```tsx
function TabIcon({
  Icon,
  color,
  focused,
  showDot,
  dotColor,
  dotBorderColor,
}: {
  Icon: FC<{ size?: number; color: string }>;
  color: string;
  focused: boolean;
  showDot?: boolean;
  dotColor: string;
  dotBorderColor: string;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.12 : 1, { damping: 14, stiffness: 220 });
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={iconStyle}>
      <Icon size={24} color={color} />
      {showDot && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: dotColor,
            borderWidth: 1.5,
            borderColor: dotBorderColor,
          }}
        />
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 3: Feed the unread count in**

Inside `MainTabs`, after `const styles = createStyles(theme);`:

```tsx
  const circleId = useAuthStore((state) => state.activeCircleId);
  const userId = useAuthStore((state) => state.user?.id);
  const { unreadCount } = useMomentsUnread(circleId ?? undefined, userId);
```

Then replace the `tabBarIcon` option with:

```tsx
        tabBarIcon: ({ color, focused }) => (
          <TabIcon
            Icon={ICONS[route.name]}
            color={color}
            focused={focused}
            // Only Today hosts the Moments feed, and a dot on the screen
            // you are already looking at is noise.
            showDot={route.name === 'Today' && !focused && unreadCount > 0}
            dotColor={colors.primary}
            dotBorderColor={colors.surface}
          />
        ),
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/navigation/MainTabs.tsx`
Expected: no output from either

- [ ] **Step 5: Commit**

```bash
git add src/navigation/MainTabs.tsx
git commit -m "Show unread dot on Home tab when Moments has new activity"
```

---

### Task 6: Rename the Connection tab to "Together"

Display-only. The route name `Connection` stays, so `MainTabParamList`, deep links and every `navigation.navigate('Connection')` call keep working.

**Files:**
- Modify: `src/navigation/MainTabs.tsx`
- Modify: `src/screens/ConnectionScreen.tsx`

- [ ] **Step 1: Update the tab options**

In `src/navigation/MainTabs.tsx`, replace the Connection screen entry:

```tsx
      <Tab.Screen
        name="Connection"
        component={ConnectionScreen}
        options={{ title: 'Together', tabBarLabel: 'Together' }}
      />
```

- [ ] **Step 2: Update the on-screen heading**

In `src/screens/ConnectionScreen.tsx` at line 221, replace:

```tsx
          <Text style={styles.title}>Connection Moments</Text>
```

with:

```tsx
          <Text style={styles.title}>Together</Text>
```

This is the only visible occurrence of the old name in this file — line 233's `Ask Friends` and line 316's `sectionTitle` style are unrelated and stay as they are.

- [ ] **Step 3: Confirm no route names changed**

Run: `grep -rn "'Connection'" src/ | grep -v "tabBarLabel\|title:"`
Expected: navigation calls and type definitions still reference `'Connection'` — these must be unchanged.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/navigation/MainTabs.tsx src/screens/ConnectionScreen.tsx`
Expected: no output from either

- [ ] **Step 5: Commit**

```bash
git add src/navigation/MainTabs.tsx src/screens/ConnectionScreen.tsx
git commit -m "Rename Connection tab to Together, freeing Moments for the feed"
```

---

### Task 7: Restructure notification settings

Two headline switches, with the existing nine categories moved under an Advanced disclosure. Writes to the existing `notification_mutes` table using two new category keys — no schema change.

**Files:**
- Modify: `src/hooks/useNotificationMutes.ts`
- Modify: `src/screens/CircleSettingsScreen.tsx`

**Interfaces:**
- Produces: `TIER_SWITCHES` exported from `src/hooks/useNotificationMutes.ts`

- [ ] **Step 1: Add the tier switch definitions**

In `src/hooks/useNotificationMutes.ts`, above `MUTE_CATEGORIES`:

```ts
// The two headline switches (docs/superpowers/specs/2026-07-31-notifications-
// design.md). They share notification_mutes with the per-category rows -
// the column is free text, so no migration is needed. A tier switched off
// silences that whole tier; switched on, the per-category mutes below apply.
// Circle management (join requests and approvals) ignores both, matching
// notify-circle's deliberately unmutable 'membership' category.
export const TIER_SWITCHES = [
  { key: 'tier_immediate', label: 'Personal alerts', hint: 'When someone needs you' },
  { key: 'tier_digest', label: 'Daily digest', hint: "Your circle's day, once each evening" },
] as const;
```

- [ ] **Step 2: Replace the Notifications section**

In `src/screens/CircleSettingsScreen.tsx`, replace the existing Notifications block with:

```tsx
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.memberList}>
          {TIER_SWITCHES.map(({ key, label, hint }) => {
            const muted = mutedCategories?.includes(key) ?? false;
            return (
              <View key={key} style={styles.notifyRow}>
                <View style={styles.notifyLabelCol}>
                  <Text style={styles.notifyLabel}>{label}</Text>
                  <Text style={styles.notifyHint}>{hint}</Text>
                </View>
                <ToggleSwitch
                  value={!muted}
                  onValueChange={(next) => toggleMute.mutate({ category: key, muted: !next })}
                />
              </View>
            );
          })}
        </View>

        <DisclosureSection label="Advanced">
          <View style={styles.memberList}>
            {MUTE_CATEGORIES.map(({ key, label }) => {
              const muted = mutedCategories?.includes(key) ?? false;
              return (
                <View key={key} style={styles.notifyRow}>
                  <Text style={styles.notifyLabel}>{label}</Text>
                  <ToggleSwitch
                    value={!muted}
                    onValueChange={(next) => toggleMute.mutate({ category: key, muted: !next })}
                  />
                </View>
              );
            })}
          </View>
        </DisclosureSection>
```

- [ ] **Step 3: Update imports**

```tsx
import { DisclosureSection } from '../components/DisclosureSection';
import { MUTE_CATEGORIES, TIER_SWITCHES, useNotificationMutes, useToggleMute } from '../hooks/useNotificationMutes';
```

- [ ] **Step 4: Add the two new styles**

In `createStyles` in `CircleSettingsScreen.tsx`:

```tsx
    notifyLabelCol: { flex: 1, gap: 1 },
    notifyHint: { fontSize: 12, color: colors.textSecondary },
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useNotificationMutes.ts src/screens/CircleSettingsScreen.tsx`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNotificationMutes.ts src/screens/CircleSettingsScreen.tsx
git commit -m "Restructure notification settings into two tiers plus Advanced"
```

---

### Task 8: Full verification and documentation

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run everything**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# pass 6 / # fail 0`, then no output from either of the other two.

- [ ] **Step 2: Verify on a device**

Publish to preview and check on a real phone:

```bash
npx eas-cli update --channel preview --message "Moments foundation" --non-interactive
```

Confirm, in order:
1. Today's feed heading reads **Moments**.
2. The fifth tab reads **Together**.
3. Have another member log a goal; a dot appears on the Home tab.
4. Open Today; the dot clears and a **New** divider sits above their event.
5. Background the app, reopen it, return to Today; the divider is gone and no dot.
6. Circle Settings shows **Personal alerts** and **Daily digest**, with the nine originals under **Advanced**.

- [ ] **Step 3: Document it**

Add to `ARCHITECTURE.md`, near the "Card shell" and tab-bar notes:

```markdown
- **Moments feed and unread state** (docs/superpowers/specs/2026-07-31-notifications-design.md): Today's activity feed is named **Moments** and the former "Connection Moments" tab is now **Together** — display renames only, the `Connection` route name is unchanged so deep links and `MainTabParamList` still resolve. Unread state lives in `circle_members.last_read_events_at`, stamped on screen focus (not scroll) through the `mark_moments_read` RPC. The RPC exists because the only UPDATE policy on `circle_members` (`0003`) is owner/admin-only, and a permissive "update your own row" policy would be a privilege escalation — RLS grants the whole row, so a member could also set `role = 'owner'`. `countUnreadEvents` ([src/lib/moments.ts](src/lib/moments.ts)) excludes the viewer's own events so your own actions never mark your feed unread; it is dependency-free so `node:test` can import it under `--experimental-strip-types` (`npm test`, the repo's first unit tests). Notification settings are now two tier switches (`tier_immediate` / `tier_digest`, stored as ordinary `notification_mutes` rows since the category column is free text) with the original nine categories under an Advanced disclosure.
```

- [ ] **Step 4: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "Document Moments feed, unread state and settings restructure"
```

---

## What this plan deliberately does not do

Push-notification behaviour is **unchanged** by this plan. Every event still notifies the whole circle exactly as it does today. Quieting that is Plan 2 (tier map, daily digest, and the two recipient bugs), which is safe to ship only once this awareness layer is live — otherwise activity becomes invisible with nothing signalling it.
