# Removing the last two AI features

**Date:** 2026-08-01
**Status:** Approved design, ready for implementation planning

## Problem

Two Claude API calls remain in Kinly, both on the Circle tab inside "More for your circle":

- **`weekly-recap`** turns a week's stats into one warm sentence.
- **`circle-ai-insight`** writes one coaching line plus a themed 7-day challenge title from per-category streak totals.

Neither computes anything. The client's own RLS-scoped queries already produce every number both functions receive; the API is used solely to phrase them. That is the same shape as the nudge generator replaced earlier today — real data, an LLM used for wording — and it carries the same costs: money per call, a third-party round trip, an `ANTHROPIC_API_KEY` to keep alive, a per-user daily cap that degrades silently, and the standing risk that a model asked to sound warm will assert something the numbers do not support.

The product decision is that Kinly ships no AI.

## Governing principle

> **The numbers are already true. Only the sentence needs writing, and a sentence assembled from true numbers cannot be wrong about them.**

## What replaces them

Two pure, dependency-free, unit-tested modules — matching `needsAttention` / `stepGoal` / `nudgeMessages` / `gardenGrowth`.

### `src/lib/weeklyHighlight.ts`

```ts
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

export function weeklyHighlight(stats: WeeklyHighlightStats): string;
```

A decision tree over what the week actually was, evaluated in priority order and returning the first match. The ordering is the design — it decides which true thing is worth saying when several are true at once:

1. **Nothing happened at all** (no goals, no milestones, no nudges, no asks) — a quiet-week line that does not scold. `MoodCheckinCard`'s no-shame rule applies to what the app says about a whole circle too.
2. **Someone's streak was saved** — the most human thing that can happen in a week, and it names a person.
3. **A long streak is running** (`bestStreak >= 14`) — the circle's most durable fact.
4. **Health climbed** meaningfully (`healthNow - healthWeekAgo >= 15`) — the garden metaphor made concrete.
5. **Volume of goals** (`goalsCompleted >= 5`) — a plainly strong week.
6. **Support given** (`nudgesSent >= 5`) — the week was about each other rather than output.
7. **Anything at all happened** — a modest, honest fallback.

Returns `''` for nothing, so `WeeklyRecapCard`'s existing `data.highlight ? … : null` guard keeps working untouched.

### `src/lib/circlePrompts.ts`

```ts
export interface CirclePrompt {
  message: string;
  suggestedChallenge: string;
}

export function circlePrompt(
  strongest: InterestCategoryName,
  weakest: InterestCategoryName | null,
  weekSeed: number,
): CirclePrompt;
```

`InterestCategoryName` is `'health' | 'wealth' | 'ideas' | 'learning' | 'relationships'` — declared locally as a string union rather than imported, so the module stays dependency-free for `node:test`.

- **`message`** names the circle's strongest category and, when there is one, nudges toward the weakest. Curated per category pair-half, not generated.
- **`suggestedChallenge`** is drawn from ~4 curated titles for the *weakest* category (the one worth working on), falling back to the strongest when every category is equal.

**`weekSeed` makes the pick stable for a week.** Without it the suggestion would change on every render — a challenge that rewrites itself while you read it is not a suggestion. The caller passes an ISO-week number, so the same circle sees the same challenge all week and a fresh one next Monday. Injected rather than computed inside, so tests pin it.

## Call-site changes

**`useWeeklyRecap`** drops its `supabase.functions.invoke(WEEKLY_RECAP_FUNCTION, …)` and sets `highlight: weeklyHighlight(stats)`. The stats object it already builds supplies every field.

**`useCircleAI`** drops its `supabase.functions.invoke('circle-ai-insight', …)` and calls `circlePrompt(strongest, weakest, isoWeek(new Date()))`. Its `CircleAIInsight` interface is unchanged in shape, so `CircleAICard` needs no rewiring — `message` and `suggestedChallenge` are populated the same way, and `suggestedChallenge` stops being nullable in practice.

Both hooks lose their try/catch-and-tolerate-failure paths: there is no longer anything that can fail.

## Renaming

The card is titled **"Kinly AI"**. That becomes **"Circle Ideas"** — leaving it would be a false claim about how the app works, which matters more than the name itself.

## What is deleted

- `supabase/functions/weekly-recap/` and `supabase/functions/circle-ai-insight/`, and both Dashboard deployments (by hand).
- **`increment_ai_usage` loses its last caller.** The RPC and the `ai_rate_limits` table (migration `0028`) stay in place — dropping them is a schema change with no benefit — but every documentation claim that they gate live AI calls is now false and must be corrected.
- `ANTHROPIC_API_KEY` is no longer read by anything. Removing the secret is the operator's call, not this change's.

**After this, no code in the repo calls any AI API.**

## Testing

Unit tests with `node:test` for both modules, following the established pattern.

`weeklyHighlight`: one test per branch of the priority order, plus the cases that decide *ordering* — a week where several conditions are true at once must return the higher-priority one. Plus the empty-week case, and a check that no branch can interpolate `null` (`mostWateredFriendName` is nullable and appears in copy).

`circlePrompt`: same seed returns the same result; different seeds vary within the category's set; a null `weakest` falls back to the strongest; every category has both a message and at least one challenge, so no combination can return an empty string.

## What this costs

The highlight becomes more repetitive week to week, especially for circles whose weeks look similar — a decision tree cannot notice an unusual pattern or find an unexpected angle the way free-form generation could. That is the accepted trade, the same one taken on nudges. The mitigation is that the priority order leads with whichever true fact is most interesting, rather than always reporting the same metric first.

## Out of scope

- **Dropping `ai_rate_limits` or `increment_ai_usage`.** Dead but harmless; removing them is a migration with no upside.
- **Removing the `ANTHROPIC_API_KEY` secret.** Operator action.
- **Reworking `WeeklyRecapCard` or `CircleAICard` beyond the title change.** Both already render these fields; only the source changes.

## Success criteria

- No code path in the repo calls an AI API.
- The weekly recap still shows a sentence, and it is always true of the numbers beside it.
- The suggested challenge does not change between renders within the same week.
- No card renders an empty or `null`-interpolated string.
- Nothing in the app is named "AI" that is not AI.
