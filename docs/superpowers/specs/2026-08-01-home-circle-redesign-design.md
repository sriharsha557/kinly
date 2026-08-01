# Home and Circle redesign — two questions, two screens

**Date:** 2026-08-01
**Status:** Approved design, ready for implementation planning

## Problem

Three complaints, one root cause.

1. **The garden on Home never says which circle it belongs to.** A member of two circles reads their garden with no idea whose it is.
2. **Switching circles means leaving.** The only switcher lives in the body of the Circle tab, so changing context is: Home → Circle → pick → back to Home. You leave the screen you wanted in order to change what it shows.
3. **The garden renders on both tabs.** `GardenHero` appears on Home as `variant="overview"` and again on Circle as `variant="tend"`. The Circle tab is a second dashboard rather than its own thing.

Underneath all three: neither tab has a question it alone answers. Home and Circle both show circle status, so neither is the place to look.

## Governing principle

> **Home answers "How am I doing today?"**
> **Circle answers "How are we doing today, and is there anything I should do?"**

Every element on either screen earns its place by serving its screen's question. This is the test for anything added later.

## Home

Order, top to bottom:

```
Bloom Circle ▾              ← new
Good morning, Sri
Friday, 1 August

┌────────────────────────┐
│   🌷  🌱  🌳  🌸       │  GardenHero, variant="overview", unchanged
│  6/8 checked in today  │  whole hero taps → Circle tab
└────────────────────────┘

Today's Mission             unchanged
How's today going?          unchanged
[Start Challenge][Log Progress][Ask Friends]
Moments                     unchanged
```

**Changes:**

- A `CirclePicker` chip is added above the greeting, in its `chip` variant.
- `QuickActionsRow`'s middle action is relabelled **Check In → Log Progress**. Its destination (the `Goals` tab) does not change. "Check In" collided with the mood check-in sitting directly above it in the same scroll, and was ambiguous between mood, attendance, daily login and goal completion.

Everything else on Home stays exactly as it is. The mood check-in ("How's today going?") explicitly remains — it is the clearest expression of Home's question.

**Why the chip sits above the greeting rather than on the hero:** circle context is screen-level, not garden-level, so one control can serve both tabs. It renders quiet (`textSecondary`, `caption` size) so the greeting keeps its role as the screen's warm opener.

## Circle

```
Bloom Circle ▾                        ⚙ Settings

┌────────────────────────────────────┐
│  🌿  Healthy                       │  CircleHealthCard — new
│  8/10 checked in today             │
│  3 active streaks · 1 needs support│
└────────────────────────────────────┘

CIRCLE TODAY
  Sara  · 12-day streak ends today     [💧 Water]
  Meera · had a tough day              [Check in]
  Ravi  · quiet for 4 days             [Cheer]

MEMBERS
  Amit   🌳 12-day streak · Great      [Cheer]
  You    🌱 4-day streak
  Priya  🌸 31-day streak              [Cheer]

Circle Challenges
Accountability Buddy
▸ More for your circle
```

**Changes:**

- The screen title "Circle" is replaced by `CirclePicker` in its `title` variant. The tab is already labelled Circle; a heading repeating it while the circle's actual name is hidden is wasted.
- `CircleSwitcher` (the horizontal chip row) is **deleted**.
- `GardenHero variant="tend"` is **removed from this screen**, replaced by `CircleHealthCard` (identity + health, no plants) and the two member sections below it.
- **Circle Today** and **Members** are new.
- **Challenges moves above Buddy.** Challenges are collective; Buddy is a pairing. The collective belongs higher on the screen that answers "how are *we*".
- The "More for your circle" disclosure is unchanged in content and stays last.

**Why the garden leaves this screen but its identity does not.** Everything `variant="tend"` could do — tap a plant to water or cheer — is now a labelled row with a visible action, which is more discoverable and more accessible than tapping 56dp plants. But dropping the garden entirely would cost the shared identity that is Kinly's differentiator, so `CircleHealthCard` keeps the stage art and the health word at the top of the screen.

### CircleHealthCard

A single card, always present, that answers "how are we?" before the screen asks anything of you.

| Element | Source | Notes |
|---|---|---|
| Stage art + health word | `useGardenState().health` | Thriving ≥80 · Healthy 40–79 · Needs care 1–39 · Dormant 0 |
| "N/M checked in today" | `useTodayMoodCheckins` + active member count | RLS already hides departed members from the client, so no `deleted_at` filter is needed here (unlike the service-role edge functions) |
| "N active streaks" | `useGardenState().members` | count of members with `streak > 0` |
| "N need support" | `needsAttention()` length | omitted from the line entirely when 0 |

The health word is the existing four-state vocabulary from `design/REDESIGN.md` §5.2, reused rather than reinvented.

### Circle Today

Rows returned by `needsAttention()` (below), each with exactly one filled-accent action.

| Reason | Row copy | Action | Underlying mutation |
|---|---|---|---|
| `streak_at_risk` | "{n}-day streak ends today" | 💧 Water | `useWaterStreak` |
| `tough_day` | "had a tough day" | Check in | `useSendNudge`, kind `keep_going` |
| `quiet` | "quiet for {n} days" | Cheer | `useSendNudge`, kind `cheer` |

**Empty state.** When nobody qualifies, the section renders positively rather than vanishing or reading as blank — the app's sprout icon, then:

> **Your circle is doing well today.**
> Everyone checked in and no one needs support.

A section that silently disappears leaves you unsure whether it checked. The confirmation is the point.

**The viewer never appears in Circle Today.** You cannot nudge yourself, and "you've been quiet 4 days" framed as someone else's task is exactly the shame mechanic `MoodCheckinCard` rules out.

### Members

Every active member except those already shown in Circle Today, including the viewer.

Each row: name, stage art, streak, and today's mood word if they checked in. Rows other than the viewer's carry an **outline** Cheer action.

**Actions here stay visually quieter than Circle Today's** — outline, not filled. If every row shouts equally the urgent section stops being urgent.

## New components and modules

### `CirclePicker` — `src/components/CirclePicker.tsx`

Renders the active circle's name with a chevron; tapping opens a sheet listing the viewer's circles and switching on selection.

- `variant="chip"` — small, `textSecondary`, `caption` size. Home.
- `variant="title"` — `title` type, `textPrimary`. Circle.

Consumes the existing `useMyCircles` and `useAuthStore`'s `setActiveCircleId`. Replaces `CircleSwitcher`, which is deleted.

### `useNudgeMember` — `src/hooks/useNudgeMember.ts`

**The gap this closes.** `useSendNudge` requires an `eventId` — nudges hang off a row in `events`. On Today that is fine, because you nudge an event you can see in the feed. A member row on the Circle tab has no event to attach to, and a member who has gone quiet has, by definition, produced none recently.

`useCheckInOnBuddy` already solved exactly this for the buddy flow: insert an `events` row of type `buddy_checkin` whose `user_id` is the person being reached out to, then hang the nudge off it. `useNudgeMember` generalises that one flow so both callers share it:

```ts
useNudgeMember(circleId: string | undefined): UseMutationResult<
  void, Error, { targetId: string; targetName: string; fromUserId: string; kind: NudgeKind }
>
```

It inserts the `buddy_checkin` event, generates copy with the existing `generateNudgeMessage(kind, name)`, then inserts the `nudges` row. `useCheckInOnBuddy` is refactored to call it rather than keeping a second copy of the same two inserts.

Migration `0041`'s policy already permits this: it admits `type = 'buddy_checkin'` from any `is_circle_member(circle_id)`, not only from the target's buddy.

**One copy change follows.** `describeEvent`'s `buddy_checkin` case currently reads "{name}'s buddy checked in on them", which is wrong once a non-buddy can send one. It becomes "{name} got a check-in from a circle-mate" — true for both callers.

### `needsAttention` — `src/lib/needsAttention.ts`

Pure and dependency-free, unit-tested with `node:test`, matching the pattern already established by `src/lib/moments.ts`, `src/lib/gardenGrowth.ts` and `supabase/functions/notify-circle/tiers.ts`.

```ts
export type AttentionReason = 'streak_at_risk' | 'tough_day' | 'quiet';

export interface AttentionInput {
  members: readonly { userId: string; name: string }[];
  goals: readonly { id: string; user_id: string; last_logged_date: string | null; streak_count: number }[];
  toughToday: readonly string[];  // user_ids who logged mood 'tough' today
  viewerId: string;
  now: number;                    // Date.now(), injected so the module stays pure and testable
}

export interface AttentionRow {
  userId: string;
  name: string;
  reason: AttentionReason;
  detail: string;      // ready-to-render copy, e.g. "12-day streak ends today"
  goalId?: string;     // set only for streak_at_risk; water_streak needs it
}

export function needsAttention(input: AttentionInput): AttentionRow[];
```

Everything is derived from `goals` and `toughToday`; `members` supplies only identity. `now` is a parameter rather than a call to `Date.now()` inside, so the tests can pin a date instead of computing expectations relative to the day they run.

**Rules:**

- `streak_at_risk` — the member owns a goal whose `last_logged_date` is exactly 2 days ago. This is the single-day grace window `water_streak()` enforces server-side; the predicate currently lives inlined in `BuddyCard.tsx` as `isInGraceWindow` and **moves here**, so Buddy and Circle can no longer disagree about who is waterable. Client-side it decides only whether to offer the action — the RPC re-validates. `detail` reads "{goal.streak_count}-day streak ends today"; where a member has several such goals, the one with the longest streak wins (most to lose).
- `tough_day` — the member's `user_id` appears in `toughToday`. `detail` reads "had a tough day".
- `quiet` — the member's most recent `last_logged_date` across all their goals is **more than 3 days** ago (so 4+), which is exactly `useGarden.stageFor()`'s `days > 3` wilt threshold. The two must agree: a member showing wilted art in Members while absent from Circle Today would read as a bug. `detail` reads "quiet for {n} days".
- **A member who has never logged anything is not "quiet".** `stageFor()` renders them `wilted` because it has no date to work from, but there is nothing for them to have lapsed from, and prompting the circle to chase a brand-new member is hostile. They appear in Members, never in Circle Today.
- **Ranking:** `streak_at_risk` → `tough_day` → `quiet`. At-risk streaks come first because the grace window closes today; the others keep.
- **One row per member.** A member matching several signals appears once, under the most urgent.
- **The viewer is excluded** from the result entirely.

## Data

**No new queries and no schema change.** Every input already exists:

| Need | Source |
|---|---|
| members, stage, streak, health | `useGardenState(circleId)` |
| waterable goals | `useGoals(circleId)` (`last_logged_date`, `user_id`) |
| tough days, today's moods, checked-in count | `useTodayMoodCheckins(circleId)` |
| the viewer's circles | `useMyCircles(userId)` |
| actions | `useWaterStreak`, `useSendNudge` |

This redesign is presentation only.

## Iconography

Row markers use the app's own SVG icon set, **not emoji**. `design/PRINCIPLES.md` sets one icon family, and as of 2026-08-01 every live SVG asset takes its colour from a `color` prop, so these markers follow the user's chosen accent like everything else. Emoji cannot.

The existing `💧 Water` button label is retained as-is — it is established copy on the streak-save flow, not a new icon.

The emoji in this document's layout sketches (🌿, 🌷, 🌳, 🌸) stand in for the garden's stage art. They are diagram shorthand, not literal copy.

## What is retired

- `CircleSwitcher` — deleted, replaced by `CirclePicker`.
- `GardenHero variant="tend"` — the variant and its plant-tap popover are removed. `variant="overview"` on Home is untouched.
- `isInGraceWindow` in `BuddyCard.tsx` — moves into `needsAttention.ts`; `BuddyCard` imports it rather than keeping a copy.

## Out of scope

- **Moments on the Circle tab.** The feed lives on Home. Putting it on both re-creates the duplication this redesign removes, and would push Challenges and Buddy below the fold.
- **Renaming the `Circle` route.** Display changes only; `MainTabParamList` and every `navigate('Circle')` call are untouched, exactly as with the Together rename.
- **Reordering Home.** Beyond the new chip and the one relabelled shortcut, Home's hierarchy is unchanged.
- **A "Circle Pulse" concept name.** Considered and rejected in favour of "Circle Today": Kinly already ships `ConceptHint` explainers because coined names confused users, and this section needs no new term.

## Success criteria

- A member of two circles can tell which circle Home is showing, and switch without leaving the screen.
- The garden renders once in the app.
- Opening Circle answers "how are we doing" in the first screenful, and any action needed of you is above the fold.
- A day where nobody needs anything reads as good news, not as an empty list.
- `needsAttention` is the only place any of the three signals is defined.
