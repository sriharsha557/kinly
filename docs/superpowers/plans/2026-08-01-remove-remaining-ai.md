# Removing the Last Two AI Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two remaining Claude API calls — the weekly recap's highlight sentence and the circle insight's coaching line plus challenge suggestion — with pure, unit-tested modules, so no code in the repo calls an AI API.

**Architecture:** Both edge functions receive numbers the client already computed and return only wording. Two dependency-free modules replace them: `weeklyHighlight` is a priority-ordered decision tree over a week's stats, and `circlePrompt` returns curated per-category copy with a week-stable seed. The hooks call them directly, losing their network calls and their tolerate-failure paths; both edge functions are deleted.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, React Query, `node:test` with `--experimental-strip-types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-remove-remaining-ai-design.md` governs all behaviour here.
- **Governing principle:** *The numbers are already true. Only the sentence needs writing, and a sentence assembled from true numbers cannot be wrong about them.*
- **After this, no code in the repo calls any AI API.** Task 6 verifies it with a grep.
- **Both new modules must be dependency-free** — zero imports — so `node:test` can load them under `--experimental-strip-types`.
- **Nothing may render an empty or `null`-interpolated string.** `mostWateredFriendName` is nullable and appears in copy.
- **The challenge suggestion must not change between renders within the same week** — hence an injected `weekSeed` rather than anything computed inside.
- **Nothing in the app may be named "AI" that is not AI.** The `CircleAICard` title becomes "Circle Ideas".
- **No raw hex in components.** All colour from `useTheme()` tokens (`design/PRINCIPLES.md`); 13px type floor.
- **Verification commands:** `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three clean before a task is committed.
- **Test count starts at 75.**
- **Test imports use the explicit `.ts` extension** (`from './weeklyHighlight.ts'`) — Node ESM performs no extension resolution.
- **Every commit message body ends with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

### Task 1: `weeklyHighlight` — one true sentence about the week

**Files:**
- Create: `src/lib/weeklyHighlight.ts`
- Create: `src/lib/weeklyHighlight.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface WeeklyHighlightStats { goalsCompleted: number; streakMilestones: number; nudgesSent: number; asksPosted: number; bestStreak: number; mostWateredFriendName: string | null; healthNow: number; healthWeekAgo: number | null }` and `weeklyHighlight(stats: WeeklyHighlightStats): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/weeklyHighlight.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyHighlight, type WeeklyHighlightStats } from './weeklyHighlight.ts';

const QUIET: WeeklyHighlightStats = {
  goalsCompleted: 0,
  streakMilestones: 0,
  nudgesSent: 0,
  asksPosted: 0,
  bestStreak: 0,
  mostWateredFriendName: null,
  healthNow: 0,
  healthWeekAgo: null,
};

function week(overrides: Partial<WeeklyHighlightStats>): WeeklyHighlightStats {
  return { ...QUIET, ...overrides };
}

test('a week where nothing happened is not scolded', () => {
  const line = weeklyHighlight(QUIET);
  assert.equal(line, 'A quiet week. Next one is yours.');
});

test('a saved streak names the person and outranks everything else', () => {
  // Deliberately also a big-streak, high-volume, health-climbing week - the
  // one thing a person did for another person still wins.
  const line = weeklyHighlight(
    week({
      mostWateredFriendName: 'Priya',
      bestStreak: 30,
      goalsCompleted: 20,
      nudgesSent: 20,
      healthNow: 90,
      healthWeekAgo: 10,
    }),
  );
  assert.equal(line, "Someone had Priya's back this week - their streak survived.");
});

test('a long streak leads when nobody needed saving', () => {
  const line = weeklyHighlight(week({ bestStreak: 21, goalsCompleted: 20, nudgesSent: 20 }));
  assert.equal(line, 'A 21-day streak is carrying this circle.');
});

test('fourteen days is long enough to lead', () => {
  assert.equal(weeklyHighlight(week({ bestStreak: 14 })), 'A 14-day streak is carrying this circle.');
});

test('thirteen days is not', () => {
  assert.notEqual(
    weeklyHighlight(week({ bestStreak: 13, goalsCompleted: 6 })),
    'A 13-day streak is carrying this circle.',
  );
});

test('a climbing garden leads over goal volume', () => {
  const line = weeklyHighlight(week({ healthNow: 80, healthWeekAgo: 60, goalsCompleted: 9 }));
  assert.equal(line, 'Your garden is greener than it was last week.');
});

test('a small health change is not a story', () => {
  const line = weeklyHighlight(week({ healthNow: 62, healthWeekAgo: 60, goalsCompleted: 9 }));
  assert.equal(line, '9 goals finished. A strong week.');
});

test('no health history means no health claim', () => {
  // healthWeekAgo is null until circle_health_snapshots has a week of data.
  const line = weeklyHighlight(week({ healthNow: 95, healthWeekAgo: null, goalsCompleted: 9 }));
  assert.equal(line, '9 goals finished. A strong week.');
});

test('goal volume leads over support given', () => {
  assert.equal(weeklyHighlight(week({ goalsCompleted: 5, nudgesSent: 9 })), '5 goals finished. A strong week.');
});

test('support given leads when little was finished', () => {
  assert.equal(
    weeklyHighlight(week({ goalsCompleted: 1, nudgesSent: 6 })),
    'Plenty of encouragement went around this week.',
  );
});

test('a small amount of anything still gets a line', () => {
  assert.equal(weeklyHighlight(week({ goalsCompleted: 1 })), 'Something moved this week. That counts.');
  assert.equal(weeklyHighlight(week({ asksPosted: 1 })), 'Something moved this week. That counts.');
  assert.equal(weeklyHighlight(week({ streakMilestones: 1 })), 'Something moved this week. That counts.');
});

test('a null name can never reach the copy', () => {
  // The saved-streak branch is the only one that interpolates a name, and it
  // must not fire without one.
  const line = weeklyHighlight(week({ mostWateredFriendName: null, bestStreak: 30 }));
  assert.ok(!line.includes('null'));
  assert.ok(!line.includes('undefined'));
});

test('every branch returns a non-empty sentence', () => {
  const cases: Partial<WeeklyHighlightStats>[] = [
    {},
    { mostWateredFriendName: 'Sara' },
    { bestStreak: 40 },
    { healthNow: 90, healthWeekAgo: 50 },
    { goalsCompleted: 12 },
    { nudgesSent: 12 },
    { asksPosted: 1 },
  ];
  for (const c of cases) {
    const line = weeklyHighlight(week(c));
    assert.ok(line.length > 0, JSON.stringify(c));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './weeklyHighlight.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/weeklyHighlight.ts`:

```ts
// One sentence about a circle's week, assembled from numbers the client has
// already computed (docs/superpowers/specs/2026-08-01-remove-remaining-ai-
// design.md). Replaces a Claude API call that received these same numbers and
// returned only wording.
//
// The ORDER is the design. Several of these are usually true at once, and the
// order decides which true thing is worth saying. A saved streak comes second
// - above longer streaks, above volume - because it is the only line that
// names one person doing something for another, which is what the app is for.
// The empty week comes first and does not scold: MoodCheckinCard's no-shame
// rule applies to what the app says about a whole circle too.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface WeeklyHighlightStats {
  goalsCompleted: number;
  streakMilestones: number;
  nudgesSent: number;
  asksPosted: number;
  bestStreak: number;
  mostWateredFriendName: string | null;
  healthNow: number;
  healthWeekAgo: number | null;
}

const LONG_STREAK = 14;
const HEALTH_CLIMB = 15;
const STRONG_WEEK_GOALS = 5;
const LOTS_OF_SUPPORT = 5;

export function weeklyHighlight(stats: WeeklyHighlightStats): string {
  const {
    goalsCompleted,
    streakMilestones,
    nudgesSent,
    asksPosted,
    bestStreak,
    mostWateredFriendName,
    healthNow,
    healthWeekAgo,
  } = stats;

  const nothingHappened =
    goalsCompleted === 0 && streakMilestones === 0 && nudgesSent === 0 && asksPosted === 0;
  if (nothingHappened) return 'A quiet week. Next one is yours.';

  // Guarded on the name itself, not on a separate count - this is the only
  // branch that interpolates one, and a null here would render "null's back".
  if (mostWateredFriendName) {
    // "their", not "her": we know a name, never a pronoun.
    return `Someone had ${mostWateredFriendName}'s back this week - their streak survived.`;
  }

  if (bestStreak >= LONG_STREAK) return `A ${bestStreak}-day streak is carrying this circle.`;

  if (healthWeekAgo !== null && healthNow - healthWeekAgo >= HEALTH_CLIMB) {
    return 'Your garden is greener than it was last week.';
  }

  if (goalsCompleted >= STRONG_WEEK_GOALS) return `${goalsCompleted} goals finished. A strong week.`;

  if (nudgesSent >= LOTS_OF_SUPPORT) return 'Plenty of encouragement went around this week.';

  return 'Something moved this week. That counts.';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 13 new tests, 88 total, `# fail 0`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/weeklyHighlight.ts src/lib/weeklyHighlight.test.ts`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/lib/weeklyHighlight.ts src/lib/weeklyHighlight.test.ts
git commit -m "Add weeklyHighlight, a true sentence assembled from the week's own numbers"
```

---

### Task 2: `circlePrompt` — curated copy per category, stable for a week

**Files:**
- Create: `src/lib/circlePrompts.ts`
- Create: `src/lib/circlePrompts.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type CircleCategory = 'health' | 'wealth' | 'ideas' | 'learning' | 'relationships'`, `interface CirclePrompt { message: string; suggestedChallenge: string }`, and `circlePrompt(strongest: CircleCategory, weakest: CircleCategory | null, weekSeed: number): CirclePrompt`

- [ ] **Step 1: Write the failing test**

Create `src/lib/circlePrompts.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circlePrompt, type CircleCategory } from './circlePrompts.ts';

const ALL: CircleCategory[] = ['health', 'wealth', 'ideas', 'learning', 'relationships'];

test('the same seed always gives the same result', () => {
  const a = circlePrompt('health', 'wealth', 7);
  const b = circlePrompt('health', 'wealth', 7);
  assert.deepEqual(a, b);
});

test('the challenge is stable across a week but varies across weeks', () => {
  const seen = new Set<string>();
  for (let weekSeed = 0; weekSeed < 12; weekSeed++) {
    seen.add(circlePrompt('health', 'wealth', weekSeed).suggestedChallenge);
  }
  // Not one fixed string forever - the point of seeding is rotation.
  assert.ok(seen.size > 1, 'expected the suggestion to vary across weeks');
});

test('the challenge targets the weakest category, not the strongest', () => {
  const health = circlePrompt('wealth', 'health', 3).suggestedChallenge;
  const wealth = circlePrompt('health', 'wealth', 3).suggestedChallenge;
  assert.notEqual(health, wealth);
});

test('with no weakest category it falls back to the strongest', () => {
  const prompt = circlePrompt('learning', null, 3);
  assert.ok(prompt.suggestedChallenge.length > 0);
  assert.ok(prompt.message.length > 0);
});

test('every category pairing produces non-empty copy', () => {
  for (const strongest of ALL) {
    for (const weakest of [...ALL, null]) {
      for (const seed of [0, 1, 5, 41]) {
        const prompt = circlePrompt(strongest, weakest, seed);
        assert.ok(prompt.message.length > 0, `${strongest}/${weakest}`);
        assert.ok(prompt.suggestedChallenge.length > 0, `${strongest}/${weakest}`);
        assert.ok(!prompt.message.includes('undefined'), `${strongest}/${weakest}`);
        assert.ok(!prompt.suggestedChallenge.includes('undefined'), `${strongest}/${weakest}`);
      }
    }
  }
});

test('the message names the strongest category', () => {
  assert.match(circlePrompt('relationships', 'wealth', 1).message, /each other|relationship/i);
});

test('a negative or huge seed still picks a real message', () => {
  // weekSeed comes from date arithmetic; it must never index out of bounds.
  for (const seed of [-5, -1, 0, 999999]) {
    const prompt = circlePrompt('health', 'ideas', seed);
    assert.ok(prompt.suggestedChallenge.length > 0, String(seed));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './circlePrompts.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/circlePrompts.ts`:

```ts
// The Circle Ideas card's copy: one line about where the circle is strong,
// and a challenge worth trying next (docs/superpowers/specs/2026-08-01-
// remove-remaining-ai-design.md). Replaces a Claude API call that received
// the same category totals and returned only wording.
//
// The challenge targets the WEAKEST category - the one worth working on -
// falling back to the strongest only when every category is level.
//
// weekSeed keeps the pick stable. Without it the suggestion would change on
// every render, and a challenge that rewrites itself while you read it is not
// a suggestion. The caller passes an ISO-week number, so a circle sees one
// idea all week and a fresh one next Monday.
//
// Dependency-free so node:test can import it under --experimental-strip-types.
// CircleCategory mirrors InterestCategory in src/types/models.ts, declared
// locally rather than imported for that reason.

export type CircleCategory = 'health' | 'wealth' | 'ideas' | 'learning' | 'relationships';

export interface CirclePrompt {
  message: string;
  suggestedChallenge: string;
}

const STRENGTH_LINE: Record<CircleCategory, string> = {
  health: 'Health is where this circle is strongest right now.',
  wealth: 'This circle is building steady money habits.',
  ideas: 'Ideas are flowing in this circle.',
  learning: 'This circle keeps showing up to learn.',
  relationships: 'This circle is strongest at showing up for each other.',
};

const NUDGE_LINE: Record<CircleCategory, string> = {
  health: 'Something physical could use attention.',
  wealth: 'Money goals have gone quiet.',
  ideas: 'Nobody has started something new lately.',
  learning: 'Learning has slipped down the list.',
  relationships: 'Time to look after each other a bit more.',
};

const CHALLENGES: Record<CircleCategory, readonly string[]> = {
  health: [
    'Move every day this week',
    'Eight glasses of water, seven days',
    'Walk after dinner all week',
    'Lights out before midnight',
  ],
  wealth: [
    'No spending for three days',
    'Track every rupee this week',
    'Cancel one thing you do not use',
    'Put something aside on Friday',
  ],
  ideas: [
    'Write one page a day',
    'Ship something small by Sunday',
    'Sketch an idea every morning',
    'Finish the thing you started',
  ],
  learning: [
    'Twenty minutes of reading daily',
    'One lesson a day this week',
    'Teach the circle something on Sunday',
    'Finish the course you paused',
  ],
  relationships: [
    'Check in on someone every day',
    'Call a person you have been meaning to',
    'Say one specific thank-you a day',
    'Make a plan with someone by Sunday',
  ],
};

export function circlePrompt(
  strongest: CircleCategory,
  weakest: CircleCategory | null,
  weekSeed: number,
): CirclePrompt {
  const target = weakest ?? strongest;
  const options = CHALLENGES[target];

  // Math.abs plus modulo: weekSeed is date arithmetic from the caller, and a
  // negative or very large value must still land inside the array rather than
  // returning undefined.
  const index = Math.abs(Math.trunc(weekSeed)) % options.length;

  const message = weakest
    ? `${STRENGTH_LINE[strongest]} ${NUDGE_LINE[weakest]}`
    : STRENGTH_LINE[strongest];

  return { message, suggestedChallenge: options[index] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 7 new tests, 95 total, `# fail 0`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/circlePrompts.ts src/lib/circlePrompts.test.ts`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/lib/circlePrompts.ts src/lib/circlePrompts.test.ts
git commit -m "Add circlePrompt, curated per-category copy with a week-stable pick"
```

---

### Task 3: Point `useWeeklyRecap` at the module

**Files:**
- Modify: `src/hooks/useWeeklyRecap.ts`

**Interfaces:**
- Consumes: `weeklyHighlight` from `src/lib/weeklyHighlight` (Task 1)

- [ ] **Step 1: Swap the API call for the module**

In `src/hooks/useWeeklyRecap.ts`, replace:

```ts
      const stats = { goalsCompleted, streakMilestones, nudgesSent: nudgesSent ?? 0, asksPosted };

      let highlight = '';
      try {
        const { data, error } = await supabase.functions.invoke(WEEKLY_RECAP_FUNCTION, { body: stats });
        if (!error && data?.highlight) highlight = data.highlight as string;
      } catch {
        // Numbers still render without the AI highlight line if the function isn't deployed yet.
      }

      return { ...stats, highlight, bestStreak, mostWateredFriendName, healthNow, healthWeekAgo };
```

with:

```ts
      const stats = { goalsCompleted, streakMilestones, nudgesSent: nudgesSent ?? 0, asksPosted };

      // Assembled locally from the numbers just computed above, rather than
      // sent to an API to be phrased. No network call, so nothing here can
      // fail and no tolerate-failure path is needed.
      const highlight = weeklyHighlight({
        ...stats,
        bestStreak,
        mostWateredFriendName,
        healthNow,
        healthWeekAgo,
      });

      return { ...stats, highlight, bestStreak, mostWateredFriendName, healthNow, healthWeekAgo };
```

- [ ] **Step 2: Fix the imports**

Add:

```ts
import { weeklyHighlight } from '../lib/weeklyHighlight';
```

Then delete the now-unused `const WEEKLY_RECAP_FUNCTION = 'weekly-recap';` line. Run `npx eslint src/hooks/useWeeklyRecap.ts` afterwards — it reports anything else left unused.

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/hooks/useWeeklyRecap.ts`
Expected: 95 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeeklyRecap.ts
git commit -m "Assemble the weekly highlight locally instead of calling an API"
```

---

### Task 4: Point `useCircleAI` at the module

**Files:**
- Modify: `src/hooks/useCircleAI.ts`

**Interfaces:**
- Consumes: `circlePrompt` from `src/lib/circlePrompts` (Task 2)

- [ ] **Step 1: Add an ISO-week helper**

At the top of `src/hooks/useCircleAI.ts`, below the imports:

```ts
// Weeks since the epoch. Only its stability matters, not its absolute value:
// it holds steady for seven days and then moves on, which is exactly what
// keeps the suggested challenge from changing on every render.
function isoWeek(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}
```

- [ ] **Step 2: Swap the API call for the module**

Replace:

```ts
      let message = '';
      let suggestedChallenge: string | null = null;
      try {
        const { data, error: fnError } = await supabase.functions.invoke('circle-ai-insight', {
          body: { strongest, weakest, categoryTotals: Object.fromEntries(totals) },
        });
        if (!fnError && data) {
          message = (data.message as string) ?? '';
          suggestedChallenge = (data.suggestedChallenge as string) ?? null;
        }
      } catch {
        // No AI line yet if the function isn't deployed - card just won't render (see CircleAICard).
      }

      return { strongest, weakest, message, suggestedChallenge };
```

with:

```ts
      // Curated copy chosen from the same category totals an API used to be
      // sent. The week seed keeps one suggestion in place for seven days.
      const { message, suggestedChallenge } = circlePrompt(strongest, weakest, isoWeek(new Date()));

      return { strongest, weakest, message, suggestedChallenge };
```

- [ ] **Step 3: Fix the imports**

Add:

```ts
import { circlePrompt } from '../lib/circlePrompts';
```

`InterestCategory` and `CircleCategory` are the same five string literals, so `strongest` and `weakest` pass straight through with no cast. Run `npx eslint src/hooks/useCircleAI.ts` to catch anything left unused — `supabase` is still needed for the goals query above.

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/hooks/useCircleAI.ts`
Expected: 95 passing, then no output from either

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCircleAI.ts
git commit -m "Choose circle prompts locally instead of calling an API"
```

---

### Task 5: Rename the card, delete the functions

**Files:**
- Modify: `src/components/CircleAICard.tsx`
- Delete: `supabase/functions/weekly-recap/index.ts`
- Delete: `supabase/functions/circle-ai-insight/index.ts`

- [ ] **Step 1: Rename the card**

In `src/components/CircleAICard.tsx`, replace:

```tsx
        <Text style={styles.title}>Kinly AI</Text>
```

with:

```tsx
        {/* Not "Kinly AI" any more - nothing here calls an AI, and leaving
            the name would be a false claim about how the app works. */}
        <Text style={styles.title}>Circle Ideas</Text>
```

Leave the filename and the component name as they are. Renaming the file would touch every import for no user-visible gain; the title is what anyone actually reads.

- [ ] **Step 2: Confirm nothing still invokes the functions**

Run: `grep -rn "circle-ai-insight\|weekly-recap" src/`
Expected: no output. Any hit means Task 3 or 4 is incomplete — finish it before deleting anything.

- [ ] **Step 3: Delete both functions**

```bash
git rm -r supabase/functions/weekly-recap supabase/functions/circle-ai-insight
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/`
Expected: 95 passing, then no output from either

- [ ] **Step 5: Commit**

```bash
git add src/components/CircleAICard.tsx
git commit -m "Rename Kinly AI to Circle Ideas and delete both AI edge functions"
```

---

### Task 6: Verify and document

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run everything**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# pass 95`, `# fail 0`, then no output from either.

- [ ] **Step 2: Prove no AI call remains anywhere**

```bash
grep -rn "anthropic\|ANTHROPIC\|claude" src/ supabase/functions/
```

Expected: **no output at all.** This is the whole point of the change; a single hit means something was missed.

- [ ] **Step 3: Correct the documentation that still claims AI is used**

`ARCHITECTURE.md`'s AI rate-limiting bullet still names `circle-ai-insight` and `weekly-recap` as live callers of `increment_ai_usage`. Find it with:

```bash
grep -n "increment_ai_usage\|circle-ai-insight\|weekly-recap\|Kinly AI" ARCHITECTURE.md ROADMAP.md
```

Rewrite each hit so it describes what is true now: the RPC and its `ai_rate_limits` table (migration `0028`) still exist but have no callers, and both functions are gone. Do not delete the migration or the table.

- [ ] **Step 4: Document the change**

Add to `ARCHITECTURE.md`, after the "Nudge message library" bullet:

```markdown
- **No AI anywhere** (docs/superpowers/specs/2026-08-01-remove-remaining-ai-design.md): the last two Claude API calls — `weekly-recap`'s highlight sentence and `circle-ai-insight`'s coaching line plus challenge title — are gone, following the nudge library off the API earlier the same day. Neither ever computed anything: the client's own RLS-scoped queries already produced every number both received, and the API was used solely to phrase them. `weeklyHighlight` ([src/lib/weeklyHighlight.ts](src/lib/weeklyHighlight.ts)) is a priority-ordered decision tree over a week's stats, and the order is the design — a *saved streak* ranks above longer streaks and above goal volume, because it is the only line that names one person doing something for another; an empty week comes first and does not scold. `circlePrompt` ([src/lib/circlePrompts.ts](src/lib/circlePrompts.ts)) returns curated copy for the strongest category and a challenge aimed at the **weakest**, picked with an injected week seed so the suggestion holds for seven days instead of changing on every render. Both are pure, dependency-free and unit-tested. `CircleAICard` is titled **Circle Ideas** — its file and component keep their old names, but nothing user-facing claims AI that is not AI. `increment_ai_usage` and `ai_rate_limits` (migration `0028`) survive with no callers; they are harmless and dropping them buys nothing. Nothing in `src/` or `supabase/functions/` references Anthropic.
```

- [ ] **Step 5: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "Document that no AI call remains"
```

---

## What this plan deliberately does not do

- **Drop `ai_rate_limits` or `increment_ai_usage`.** Dead but harmless; removing them is a migration with no upside.
- **Remove the `ANTHROPIC_API_KEY` secret.** Nothing reads it after this, but deleting a project secret is an operator action.
- **Rename `CircleAICard.tsx` or its component.** The title is what users read; renaming the file touches every import for no visible gain.
- **Rework either card's layout.** Both already render these fields; only the source of the strings changes.
