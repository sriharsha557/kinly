# Beta Scope Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Kinly's beta surface to the goals + circle-accountability loop by hiding seven features behind build-time flags, merging Ask Friends into the Circle tab, and making the existing tutorial reachable again.

**Architecture:** A single `src/lib/features.ts` module exports a `Record<FeatureFlag, boolean>` of build-time constants. Each deferred feature is gated at its call site only — component files are never touched, so every hidden feature keeps compiling and typechecking. The Connection tab's sole surviving feature (Ask Friends) is extracted into a reusable component in place, verified unchanged, then rendered from the Circle tab before the tab is removed.

**Tech Stack:** Expo SDK 54 (React Native 0.81.5, React 19.1), TypeScript 5.9, `@react-navigation` v7 bottom-tabs + native-stack, TanStack Query v5, Supabase JS 2.110, Zustand 5.

## Global Constraints

- **Expo docs:** Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code (per `AGENTS.md`).
- **No raw hex in components.** Colors come from `useTheme()` tokens; spacing/type/motion from `src/theme/colors`. Muted single accent, warm-gray neutrals.
- **Test runner:** `npm test` runs `node --experimental-strip-types --test "src/**/*.test.ts" "supabase/functions/**/*.test.ts"`. It only executes **pure `.ts` modules** — there is no React component test harness in this repo. Do not invent one. UI changes are verified by `npx tsc --noEmit`, `npx expo lint`, and manual check.
- **Verification gate for every task:** `npx tsc --noEmit` clean, `npm test` green, `npx expo lint` clean.
- **Flags are build-time constants**, not remote config.
- **Reversibility rule:** flipping any single flag to `true` must restore a working surface with no other edit. Never delete a deferred feature's component, hook, or migration.
- **Commit style:** imperative subject, no `feat:`/`fix:` prefix (match existing history). End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Branch:** `feat/areas-of-growth-core`. Do not push or merge without asking.

---

### Task 1: Diagnose and fix the Ask Friends refresh bug

**This is a diagnosis task, and deliberately does not prescribe the fix.** The root cause is unknown: the obvious candidate (a mismatched query key) has already been ruled out — [`useAskPosts.ts:54`](../../../src/hooks/useAskPosts.ts) invalidates `['askPosts', variables.circleId]`, which is exactly the key `useAskPosts` registers at line 16, and `staleTime: 30_000` does not suppress an explicit invalidation of an active query. Writing fix code before reproducing would be guessing.

This runs **first** because the bug was reported against the code in its current location. Fixing it after the extraction would leave any regression with two candidate causes.

**Files:**
- Investigate: `src/hooks/useAskPosts.ts`, `src/screens/ConnectionScreen.tsx:207-212`, `src/lib/queryClient.ts`, `App.tsx` (persist/provider wiring)
- Modify: whichever file the diagnosis implicates

**Interfaces:**
- Consumes: nothing
- Produces: a working Ask Friends post → list refresh. Task 5 relies on this behaviour being correct *before* extraction.

- [ ] **Step 1: Reproduce on a device against the preview build**

Post a question in Ask Friends. Confirm it does not appear until a tab switch or pull-to-refresh. Note whether the composer clears (it calls `setQuestion('')` at `ConnectionScreen.tsx:210`, which only runs if `mutateAsync` resolved).

- [ ] **Step 2: Instrument the mutation boundary**

Temporarily add to `useCreateAskPost`'s `mutationFn` in `src/hooks/useAskPosts.ts`, immediately after the `ask_posts` insert:

```ts
      console.log('[ask] insert error:', error);
```

and at the top of `onSuccess`:

```ts
    onSuccess: (_data, variables) => {
      console.log('[ask] onSuccess, invalidating key:', ['askPosts', variables.circleId]);
      console.log('[ask] active queries:', queryClient.getQueryCache().findAll({ queryKey: ['askPosts'] }).map((q) => q.queryKey));
```

- [ ] **Step 3: Run and read the evidence**

Run: `npx expo start` and post again with the debugger console open.

This distinguishes the three live hypotheses:
- `onSuccess` never logs → the mutation rejected (the events insert at line 49-51 does **not** check its error, so suspect the `ask_posts` insert itself) and `handlePost` has no `try`/`catch`, so the rejection is silent.
- `onSuccess` logs but the cache lists a *different* key → a key-identity mismatch (e.g. `undefined` vs `null` circleId).
- `onSuccess` logs with a matching key and the list still does not update → the refetch is happening but the row is not returned; suspect the `ask_posts` SELECT policy after migrations 0019 (soft deletes) / 0034 (blocking).

- [ ] **Step 4: Write a failing test if — and only if — the cause is pure logic**

If the cause lives in a pure module, add a test to the matching `*.test.ts` and confirm it fails before fixing. If the cause is RLS, a query-key mismatch, or an unhandled rejection, there is no unit-testable seam in this repo; record the manual reproduction steps in the commit message instead.

- [ ] **Step 5: Implement the fix indicated by Step 3**

Whatever the cause, also harden the call site — `handlePost` currently swallows failures silently:

```tsx
  async function handlePost() {
    if (!question.trim() || !circleId || !userId || createPost.isPending) return;
    try {
      await createPost.mutateAsync({ circleId, userId, question: question.trim(), goalId });
    } catch (err) {
      Alert.alert('Could not post that', errorMessage(err, 'Please try again.'));
      return;
    }
    setQuestion('');
    setGoalId(null);
  }
```

Add the imports if missing: `Alert` from `react-native`, `errorMessage` from `../lib/errorMessage`.

- [ ] **Step 6: Remove the instrumentation from Step 2**

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: no type errors, 202+ tests passing, no lint errors.
Manual: post a question — it appears in the list immediately, without a tab switch.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAskPosts.ts src/screens/ConnectionScreen.tsx
git commit -F - <<'EOF'
Show an Ask Friends post without waiting for a tab switch

<one paragraph: the actual root cause found in Step 3, and why the
invalidation that looked correct was not reaching the list>

The composer also swallowed failures: handlePost awaited mutateAsync with
no catch, so a rejected insert cleared nothing and said nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Add the feature flag module

**Files:**
- Create: `src/lib/features.ts`
- Test: `src/lib/features.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `FEATURES: Record<FeatureFlag, boolean>` and `type FeatureFlag`. Tasks 3, 4 and 6 import `FEATURES` from `../lib/features` (components) or `./features` (lib).

- [ ] **Step 1: Write the failing test**

Create `src/lib/features.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, type FeatureFlag } from './features.ts';

// Guards against a typo'd or dropped key: every gate in the app reads one of
// these names, and a missing one silently evaluates to undefined - which is
// falsy, so the feature would vanish with no error anywhere.
const EXPECTED: FeatureFlag[] = [
  'guessWho',
  'circleCard',
  'wouldYouRather',
  'visionBoard',
  'meetups',
  'circleAI',
  'weeklyRecap',
];

test('every declared flag is present and boolean', () => {
  for (const flag of EXPECTED) {
    assert.equal(typeof FEATURES[flag], 'boolean', `${flag} must be a boolean`);
  }
});

test('no undeclared flags have crept in', () => {
  assert.deepEqual(Object.keys(FEATURES).sort(), [...EXPECTED].sort());
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -A3 "features"`
Expected: FAIL — cannot find module `./features.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/features.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test 2>&1 | tail -10`
Expected: PASS, total count 204.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features.ts src/lib/features.test.ts
git commit -F - <<'EOF'
Add build-time feature gates for the beta surface

Flags rather than commented-out code: a commented block stops being
typechecked and drifts within a release or two, while git already preserves
history perfectly. Gated this way every deferred feature keeps compiling, so
re-enabling one is a single-line edit.

Typed Record<FeatureFlag, boolean> rather than `as const` deliberately - a
literal false narrows each guarded branch to never, suppressing typechecking
inside exactly the code the flags exist to keep healthy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Gate the Circle tab's deferred features

**Files:**
- Modify: `src/screens/CircleScreen.tsx:211-224`

**Interfaces:**
- Consumes: `FEATURES` from Task 2
- Produces: a Circle tab whose "More for your circle" section is absent while all four of its children are deferred

- [ ] **Step 1: Add the import**

In `src/screens/CircleScreen.tsx`, alongside the other `../lib` imports:

```tsx
import { FEATURES } from '../lib/features';
```

- [ ] **Step 2: Gate the section and each child**

Replace the block at `src/screens/CircleScreen.tsx:211-224` with:

```tsx
        {/* Secondary: lower-frequency extras, tucked behind a tap so they
            don't compete for attention.

            The section is gated on its own children as well as each child
            being gated individually. With all four deferred it would
            otherwise render as an empty shell - a labelled chevron that
            opens onto nothing, which is worse than no section at all. The
            per-child gates are what keep the reversibility promise: flip one
            flag and that card comes back, inside a section that reappears
            with it. */}
        {(FEATURES.visionBoard || FEATURES.meetups || FEATURES.circleAI || FEATURES.weeklyRecap) && (
          <DisclosureSection label="More for your circle">
            {FEATURES.visionBoard && userId && circleId && (
              <VisionBoardCard circleId={circleId} userId={userId} />
            )}
            {FEATURES.meetups && userId && circleId && (
              <MeetUpCard circleId={circleId} userId={userId} />
            )}
            {FEATURES.circleAI && userId && circleId && (
              <CircleAICard
                circleId={circleId}
                userId={userId}
                onChallengeStarted={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              />
            )}
            {FEATURES.weeklyRecap && circleId && <WeeklyRecapCard circleId={circleId} />}
          </DisclosureSection>
        )}
```

Leave every import (`VisionBoardCard`, `MeetUpCard`, `CircleAICard`, `WeeklyRecapCard`, `DisclosureSection`) in place — they are still referenced inside the gate, so they stay typechecked.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual: the Circle tab ends at Buddy — no "More for your circle" header.

- [ ] **Step 4: Verify reversibility**

Temporarily set `visionBoard: true` in `src/lib/features.ts`, run `npx expo start`, confirm the section reappears containing only Vision Board, then set it back to `false`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/CircleScreen.tsx
git commit -F - <<'EOF'
Defer the Circle tab's four secondary cards behind flags

Vision Board, Meetups, Circle AI Ideas and Weekly Recap are delight features
rather than part of the goals + circle-accountability loop the beta needs to
teach. The section wrapper is gated on its children as well: with all four
deferred it would render as a labelled chevron opening onto nothing, which
is worse than no section.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Gate the Connection tab's deferred features

Done before the extraction so Task 5 moves the smallest possible amount of code.

**Files:**
- Modify: `src/screens/ConnectionScreen.tsx:230-234` (Daily Circle Card) and `:304-313` (Light Moments)

**Interfaces:**
- Consumes: `FEATURES` from Task 2
- Produces: a Connection screen containing only its title, hint, and Ask Friends

- [ ] **Step 1: Add the import**

```tsx
import { FEATURES } from '../lib/features';
```

- [ ] **Step 2: Gate the Daily Circle Card**

Replace `src/screens/ConnectionScreen.tsx:230-234` with:

```tsx
          {FEATURES.circleCard && userId && circleId && (
            <Animated.View entering={FadeInDown.duration(motion.duration.entrance)}>
              <DailyCircleCard circleId={circleId} userId={userId} />
            </Animated.View>
          )}
```

- [ ] **Step 3: Gate Light Moments**

Replace `src/screens/ConnectionScreen.tsx:304-313` with:

```tsx
          {/* Play: lighter, lower-stakes moments - tucked away so they don't
              outweigh accountability. Gated on its children so the section
              does not survive as an empty shell once both games are
              deferred. */}
          {(FEATURES.wouldYouRather || FEATURES.guessWho) && (
            <View style={styles.gamesSection}>
              <DisclosureSection label="Light Moments" icon={DiceIcon}>
                {FEATURES.wouldYouRather && userId && circleId && (
                  <WouldYouRatherCard circleId={circleId} userId={userId} />
                )}
                {FEATURES.guessWho && userId && circleId && (
                  <GuessWhoCard circleId={circleId} userId={userId} />
                )}
              </DisclosureSection>
              <View style={styles.gamesHint}>
                <ConceptHint id="light-moments" text="A daily moment of reflection." />
              </View>
            </View>
          )}
```

- [ ] **Step 4: Fix the now-stale screen hint**

`ConnectionScreen.tsx:226` reads `<ConceptHint id="connection-moments" text="A daily prompt your circle answers together." />` — that describes the Circle Card, which is now gated off. Replace the text with:

```tsx
            <ConceptHint id="connection-moments" text="Ask your circle for advice, and weigh in on theirs." />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual: the Together tab shows only the title, the corrected hint, the composer, and the post list.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ConnectionScreen.tsx
git commit -F - <<'EOF'
Defer the Circle Card and both games behind flags

Leaves the Together tab holding only Ask Friends, which is what makes the
tab merge in the following tasks worth doing. The screen hint described the
Circle Card, so it described nothing once that card was gated - it now
describes Ask Friends.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Extract AskFriendsSection, still rendered from ConnectionScreen

The riskiest task. It moves ~250 lines and must produce **zero** visible change. Nothing about navigation changes here.

**Files:**
- Create: `src/components/AskFriendsSection.tsx`
- Modify: `src/screens/ConnectionScreen.tsx`

**Interfaces:**
- Consumes: `AskPostWithProfile` from `../hooks/useAskPosts`
- Produces: `export function AskFriendsSection({ circleId, userId }: { circleId: string; userId: string })`. Task 6 renders exactly this from the Circle tab.

- [ ] **Step 1: Create the component file**

Create `src/components/AskFriendsSection.tsx`. Move these three declarations verbatim out of `ConnectionScreen.tsx`: `ReplyThread`, `AskCard`, and the composer + list markup from the screen body. The section owns its own `createStyles`, copying only the keys it uses: `sectionTitle`, `composer`, `composerInput`, `goalChips`, `goalChip`, `goalChipActive`, `goalChipRow`, `goalChipText`, `goalChipTextActive`, `postButton`, `postButtonText`, `list`, `empty`, `card`, `questionRow`, `question`, `optionsButton`, `goalTagRow`, `goalTag`, `cardFooter`, `meta`, `thread`, `replyRow`, `replyAuthor`, `replyBody`, `replyInputRow`, `replyInput`, `replySend`, `replySendText`.

The exported shell:

```tsx
export function AskFriendsSection({ circleId, userId }: { circleId: string; userId: string }) {
  const { data: posts, isLoading } = useAskPosts(circleId);
  const { data: goals } = useGoals(circleId);
  const createPost = useCreateAskPost();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [question, setQuestion] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const myGoals = (goals ?? []).filter((g) => g.user_id === userId);

  // Keep the hardening added in Task 1 - do not re-simplify this.
  async function handlePost() {
    if (!question.trim() || createPost.isPending) return;
    try {
      await createPost.mutateAsync({ circleId, userId, question: question.trim(), goalId });
    } catch (err) {
      Alert.alert('Could not post that', errorMessage(err, 'Please try again.'));
      return;
    }
    setQuestion('');
    setGoalId(null);
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Ask Friends</Text>
      {/* composer, then the isLoading / posts / empty branch, moved verbatim
          from ConnectionScreen - including the FadeInDown stagger */}
    </View>
  );
}
```

Note the prop types are non-nullable `string`, so the `userId && circleId` guards move to the call site.

- [ ] **Step 2: Render it from ConnectionScreen**

In `src/screens/ConnectionScreen.tsx`, delete `ReplyThread`, `AskCard`, the composer markup, the list markup, and every style key and import they alone used. The screen keeps only its `SafeAreaView` / `KeyboardAvoidingView` / `ScrollView` shell, the title, the hint, the `RefreshControl`, and:

```tsx
          {userId && circleId && <AskFriendsSection circleId={circleId} userId={userId} />}
```

The `RefreshControl` still needs `isFetching`/`isLoading`/`refetch`, so `useAskPosts` stays called in the screen too. That is intentional and not a duplicate fetch — TanStack Query dedupes by key, and it keeps pull-to-refresh working through the extraction. Task 7 deletes this screen anyway.

- [ ] **Step 3: Verify nothing changed**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual, on the Together tab — all must behave exactly as before:
- post a question (appears immediately, per Task 1)
- attach a goal chip; the chip toggles
- expand a post, send a reply, confirm the reply count increments
- long-press a reply by another member → moderation sheet
- delete your own post → confirm sheet, post disappears
- pull to refresh

- [ ] **Step 4: Commit**

```bash
git add src/components/AskFriendsSection.tsx src/screens/ConnectionScreen.tsx
git commit -F - <<'EOF'
Extract AskFriendsSection without moving it yet

ConnectionScreen had grown to ~400 lines with AskCard and ReplyThread
defined inline, tangled together with composer state, moderation sheets and
reply threading. Pulling that into one component with a circleId/userId
interface is the whole of this commit - it renders from exactly where it did
before, so any behaviour change here is a bug rather than the intended move.
The relocation and the tab removal follow separately.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Render Ask Friends on the Circle tab

**Files:**
- Modify: `src/screens/CircleScreen.tsx`

**Interfaces:**
- Consumes: `AskFriendsSection` from Task 5
- Produces: Ask Friends reachable from Circle. Task 7 relies on this before removing the tab.

- [ ] **Step 1: Import and render below Buddy**

```tsx
import { AskFriendsSection } from '../components/AskFriendsSection';
```

Insert immediately after the `BuddyCard` block (`CircleScreen.tsx:~208`) and before the gated "More for your circle" section from Task 3:

```tsx
        {/* Moved off its own tab: with the Circle Card and both games
            deferred, Ask Friends was the only thing left on Together, which
            does not earn a top-level destination. It sits below Buddy
            because asking the circle for advice is the most involved thing
            on this screen, not the first thing to reach for. */}
        {userId && circleId && (
          <Reveal index={5}>
            <AskFriendsSection circleId={circleId} userId={userId} />
          </Reveal>
        )}
```

- [ ] **Step 2: Verify both copies work**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual: Ask Friends now appears on **both** Circle and Together. Post from Circle, switch to Together, confirm the same post is listed (they share the `['askPosts', circleId]` cache key). This double-render is temporary and proves the component is genuinely portable.

- [ ] **Step 3: Commit**

```bash
git add src/screens/CircleScreen.tsx
git commit -F - <<'EOF'
Render Ask Friends on the Circle tab

Deliberately additive: it renders in both places for one commit so the
relocation can be verified against the original before the Together tab is
removed. Placed below Buddy - asking the circle for advice is the most
involved thing on this screen rather than the first thing to reach for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Remove the Connection tab

**Files:**
- Modify: `src/navigation/types.ts:3-9`, `src/navigation/MainTabs.tsx:31-37` and `:139-143`, `src/components/QuickActionsRow.tsx:25`
- Delete: `src/screens/ConnectionScreen.tsx`

**Interfaces:**
- Consumes: Task 6's Circle-tab placement
- Produces: a four-tab `MainTabParamList` — `Today | Circle | Goals | Profile`

- [ ] **Step 1: Drop it from the param list**

In `src/navigation/types.ts`, remove the `Connection: undefined;` line so `MainTabParamList` becomes:

```ts
export type MainTabParamList = {
  Today: undefined;
  Circle: undefined;
  Goals: undefined;
  Profile: undefined;
};
```

This makes the compiler find every remaining reference for you — run `npx tsc --noEmit` now and treat each error as a to-do for the steps below.

- [ ] **Step 2: Drop the tab and its icon**

In `src/navigation/MainTabs.tsx`, remove `Connection: ChatTabIcon,` from `ICONS`, remove the whole `<Tab.Screen name="Connection" ... />` block, and remove the now-unused `ConnectionScreen` and `ChatTabIcon` imports.

- [ ] **Step 3: Repoint Quick Actions**

In `src/components/QuickActionsRow.tsx:25`, change the tab target:

```tsx
  { label: 'Ask Friends', icon: ChatIcon, tab: 'Circle' },
```

- [ ] **Step 4: Delete the screen**

```bash
git rm src/screens/ConnectionScreen.tsx
```

Deleting here rather than in a later task: with the tab gone, nothing renders it, and leaving an unreachable 100-line screen is exactly the dead weight this work exists to remove. Git history keeps it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing, and **zero** remaining references — confirm with:

```bash
git grep -n "Connection\b" -- src/ || echo "no references"
```

Manual: four tabs (Today, Circle, Goals, Profile). Today → Quick Actions → "Ask Friends" lands on Circle. Ask Friends works there.

- [ ] **Step 6: Commit**

```bash
git add -A src/navigation src/components/QuickActionsRow.tsx src/screens
git commit -F - <<'EOF'
Drop the Together tab, taking navigation from five destinations to four

Removing Connection from MainTabParamList first makes the compiler enumerate
every remaining reference rather than trusting a grep. QuickActionsRow was
the only caller navigating to it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Make the tutorial reachable from Profile

**Files:**
- Modify: `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx:113-129`, `src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: existing `TutorialScreen({ onFinish }: { onFinish: () => void })`
- Produces: a `Tutorial` route on `RootStackParamList`

- [ ] **Step 1: Add the route to the param list**

In `src/navigation/types.ts`, add to `RootStackParamList`:

```ts
  Tutorial: undefined;
```

- [ ] **Step 2: Register the screen**

In `src/navigation/RootNavigator.tsx`, inside the `readyForMain` fragment alongside `CircleSettings` and `EditProfile`:

```tsx
            {/* The same four slides shown before first sign-in, now
                reachable again. It only ever rendered under
                `!user && !hasSeenTutorial`, so anyone past onboarding had no
                way back to the one place the app explains itself. Here
                onFinish just pops - hasSeenTutorial is already true and
                re-setting it would mean nothing. */}
            <Stack.Screen
              name="Tutorial"
              component={TutorialRoute}
              options={{ headerShown: true, title: 'How Kinly works' }}
            />
```

Add above the component, in the same file:

```tsx
function TutorialRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Tutorial'>) {
  return <TutorialScreen onFinish={() => navigation.goBack()} />;
}
```

Import the type: `import type { NativeStackScreenProps } from '@react-navigation/native-stack';`

- [ ] **Step 3: Add the Profile entry point**

In `src/screens/ProfileScreen.tsx`, directly above the `<HealthSyncRow />` block (`~line 151`):

```tsx
        <Text style={styles.sectionTitle}>Help</Text>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="View the getting started tutorial"
          style={styles.helpRow}
          onPress={() => navigation.navigate('Tutorial')}
        >
          <Text style={styles.helpRowLabel}>Help &amp; Getting Started</Text>
        </AnimatedPressable>
```

`ProfileScreen` has no existing row style — verified, its only comparable surface is `appearanceCard`. Add these two keys to its `createStyles` (whose signature is `({ colors, cardShell })` at line 223, so `cardShell` is already in scope and supplies the shared card surface + shadow):

```tsx
    helpRow: {
      ...cardShell,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      // 48 is the minimum touch target used elsewhere in this file (see the
      // Privacy Policy link below).
      minHeight: 48,
      justifyContent: 'center',
    },
    helpRowLabel: { ...type.body, fontFamily: fontFamily.medium, color: colors.textPrimary },
```

and reference them as `styles.helpRow` / `styles.helpRowLabel` in Step 3's markup.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual: Profile → Help & Getting Started → four slides → finishing returns to Profile. Confirm the tutorial does **not** reappear on next cold start.

- [ ] **Step 5: Commit**

```bash
git add src/navigation src/screens/ProfileScreen.tsx
git commit -F - <<'EOF'
Let people reach the tutorial after onboarding

TutorialScreen rendered only under `!user && !hasSeenTutorial`, so the one
place the app explains itself was unreachable the moment someone signed in -
which is roughly when the explanation starts being useful. onFinish pops
rather than setting hasSeenTutorial, which is already true by then.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Give the remaining disclosure a textual affordance

After Tasks 3 and 4, `DisclosureSection` has exactly one live caller: "Advanced" in `CircleSettingsScreen.tsx:340`. The bare `▼` / `▲` glyph never said what tapping does.

**Files:**
- Modify: `src/components/DisclosureSection.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: unchanged public props — `label`, `icon`, `defaultOpen`, `children`

- [ ] **Step 1: Replace the chevron with text**

In `src/components/DisclosureSection.tsx`, replace:

```tsx
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
```

with:

```tsx
        {/* Was a bare ▲/▼ glyph. A chevron alone states neither that the
            section opens nor what is inside it, so testers reported these
            sections as undiscoverable - the features behind them may as well
            not have shipped. */}
        <Text style={styles.toggle}>{open ? 'Hide' : 'Show'}</Text>
```

- [ ] **Step 2: Restyle it as a control rather than a glyph**

Replace the `chevron` style with:

```tsx
    toggle: { ...type.caption, fontFamily: fontFamily.medium, color: colors.primary },
```

`fontFamily.medium` and `colors.primary` match the `+ New` affordances on `ChallengesCard` and `GuessWhoCard`, so this reads as the same class of control.

- [ ] **Step 3: Announce the state to screen readers**

On the `AnimatedPressable` in the same file, add:

```tsx
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${open ? 'expanded' : 'collapsed'}`}
```

`AnimatedPressable` already forwards both props.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.
Manual: Circle → Settings → the Advanced row reads "Show", opens, reads "Hide".

- [ ] **Step 5: Commit**

```bash
git add src/components/DisclosureSection.tsx
git commit -F - <<'EOF'
Say Show and Hide instead of drawing a chevron

A bare glyph states neither that the section opens nor what is behind it,
and testers reported these sections as undiscoverable. Only the Advanced
section in Circle Settings still uses this component - the other two callers
went away with the features they contained.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Ship to preview and verify on device

**Files:** none

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npm test && npx expo lint`
Expected: clean, 204 tests passing.

- [ ] **Step 2: Confirm reversibility for all seven flags**

For each flag in `src/lib/features.ts`, set it to `true`, run `npx tsc --noEmit`, and confirm no type errors. This is the promise the whole approach rests on. Set every flag back to `false` and re-run `npx tsc --noEmit` before shipping.

- [ ] **Step 3: Publish**

```bash
npx eas-cli@latest update --branch preview \
  --message "Beta scope: four tabs, Ask Friends on Circle, tutorial from Profile" \
  --non-interactive
```

- [ ] **Step 4: Confirm the update targets the testers' build**

Run: `npx eas-cli@latest channel:view preview`
Expected: branch `preview`, runtime `1.0.0`, showing the update just published. Runtime must read **1.0.0** — the installed APK (`76985a36`, profile `preview`) is pinned there by the `appVersion` policy.

- [ ] **Step 5: Device check**

Close and reopen the app twice (Expo downloads on one launch, applies on the next). Confirm four tabs, Ask Friends under Circle, tutorial from Profile, and no empty disclosure sections.

---

## Deferred to a separate plan

These are Phase 1 stabilization items with **no root cause yet**. Planning implementation steps for an undiagnosed bug would be inventing work — each needs a `superpowers:systematic-debugging` pass first, and that pass is what produces its plan.

- **Health Connect integration** (issue 1)
- **Session timeout / recovery** (issues 2, 10) — `useBootstrapSession` does alert on an unexpected `SIGNED_OUT`, so the reported silence needs reproducing before anything is changed
- **"How is it going today?" check-in screen** (issue 3) — that exact string does not appear anywhere in `src/`; needs the screen identified first
- **Actionable join-request notifications** (issue 16) — notification action categories on both platforms plus a background approval handler
- **The unlabelled share toggle after finishing a goal** — unreproduced; the goal-completion modal already has labelled Share and Close buttons. Parked pending screen, trigger, and ideally a recording.

## Open question — two features the keep/hide list never covered

`ProfileScreen` renders two features that appear on neither list:

- **Your Story** — `LifeTimeline` (`ProfileScreen.tsx:188`, `useLifeTimeline`)
- **Future Self** — `FutureSelfCard` (`ProfileScreen.tsx:191`, `useFutureSelf`, migration 0013)

Both look like delight features by the same standard that deferred Vision
Board and Meetups, and neither serves the goals + circle-accountability loop.
They were missed because the audit walked the four content tabs and Profile
was treated as settings.

**This plan leaves both visible** — hiding a feature nobody asked to hide is
not a call to make silently. If they should be deferred, they are two more
flags and two more call-site gates, following Task 3 exactly; add
`lifeTimeline` and `futureSelf` to `FeatureFlag`, `EXPECTED` in
`features.test.ts`, and gate each `<Text style={styles.sectionTitle}>` header
together with the card beneath it so no orphaned heading survives.

## Already shipped — do not redo

Landed on `preview` on 2026-08-07, ahead of this plan:

- Guess Who repaired (`259c6a6`) — issue 4
- Challenge progress labelled and attributed per member (`c9b377d`) — issues 7, 8, 9
- Circle Card answer gate stated (`786e065`) — issues 5, 6
