# Areas of Growth — per-member commitments under shared Areas

**Date:** 2026-08-05
**Status:** Approved design, pending implementation plan

## Guiding principle

You are never comparing walking to gym. You are comparing whether each person is
honoring the commitment they made to themselves. Summaries, streaks and feed
copy all reinforce **accountability without competition**.

A corollary that decides several arguments below: any prompt or state that
appears when someone misses, skips, or opts out must be the *easiest* thing on
screen to leave. "No goal yet" is a valid resting state, permanently.

## What is actually changing

The original brief framed this as replacing "shared/common circle goals" with
per-member goals. That premise does not match the schema. Goals have always been
per-member — `goals.user_id` exists in `0001_init.sql` and RLS permits creating
only your own. What is missing is different, and this is the real scope:

| Today | After |
| --- | --- |
| `target numeric` + `progress numeric` accumulating for life | cadence (`daily`, `times_per_week`, `specific_weekdays`, `monthly`) |
| "done" = `progress >= target`, once, ever | "done" = a check-in row for the current period |
| no per-day history; `log_goal_progress` mutates in place | `goal_checkins` ledger, one row per goal per day |
| nullable freetext `category` over 5 pillars | 8 `areas`, enabled per circle via `circle_areas` |
| streak = consecutive days only | streak = consecutive successful *periods* |
| no archive | `goal_history` with lifecycle and reason |

## Decisions taken

1. **Evolve `goals` in place.** ~45 files and several tables reference
   `goals.id` (events, streak_saves, buddy check-ins, challenges, life
   timeline). Keeping the identifier keeps all of them working.
2. **The 8 Areas replace the 5 pillars app-wide.** One vocabulary, not two.
3. **`showing_up` is computed in TypeScript**, mirrored in SQL only for the two
   Deno edge functions, with shared fixtures binding the two implementations.
4. **Manual goals have no numeric target.** Only device-synced goals keep a
   number, and it is a threshold, not a user-facing target.
5. **The Area rollup leads the Circle tab.** Today keeps its personal shape.
6. **The table stays `goals`; the *entity* becomes a commitment** via lifecycle
   fields and a `kind` discriminator.

## 1. Naming: `showing_up`, never "on track"

"On track" is a judgement, and the UI must not render one. The obvious
alternatives are worse, because they are false: a member with a 4×/week cadence
who has not logged Tuesday is honoring their commitment, so counting them inside
"5/7 **Checked In**" or "5/7 **Active Today**" states something that did not
happen. Every literal-event label breaks as soon as the cadence is not daily —
precisely the case this model exists to support.

The primitive is therefore named `showing_up` in the database, `isShowingUp` in
TypeScript, and rendered as **"5 of 7 showing up"**. One name end to end; no
internal term the UI has to launder.

## 2. Data model

### New tables

```sql
areas (
  id uuid pk, key text unique, label text, emoji text, sort_order int
)
-- Seeded: health, mind, learning, finance, career, family, creativity, community
-- Readable by all authenticated users. No insert/update/delete policy exists,
-- so "members cannot create Areas" is enforced by the database, not just the UI.

circle_areas (
  circle_id uuid, area_id uuid, enabled boolean not null default true,
  created_at timestamptz,
  primary key (circle_id, area_id)
)

goal_checkins (
  id uuid pk, goal_id uuid, user_id uuid,
  checkin_date date not null, created_at timestamptz,
  unique (goal_id, checkin_date)
)
-- The unique constraint makes check-in idempotent: a double tap, an offline
-- replay and a device re-sync cannot inflate a streak.

goal_history (
  id uuid pk, circle_id uuid, user_id uuid, area_id uuid,
  title text, target_type text, target_count int, target_weekdays int[],
  started_at date, ended_at date, best_streak int,
  ended_reason text not null,   -- replaced | migration | deleted | completed
  needs_review boolean not null default false
)
```

`archived` was considered as a fifth reason and dropped: with the four endings
this design actually produces, no code path emits it, and an enum value nothing
writes is a value future readers will misuse.

### Ending a goal keeps the `goals` row

Archiving writes a `goal_history` row **and** sets `goals.status = 'ended'`; it
never deletes the goal. `events`, `streak_saves`, buddy check-ins, challenges
and the life timeline all hold `goal_id` references, and deleting would orphan
feed entries that are years of a circle's memory. `status` is therefore
`'active' | 'ended'`, which is also what makes the partial unique index
meaningful. `goal_history` is the denormalized, queryable summary — title and
cadence as they were, plus `best_streak`, which the live row does not retain
after a reset.

### `goals`, evolved

Added: `area_id`, `target_type`, `target_count`, `target_weekdays int[]`,
`status`, `started_at`, `ended_at`, `ended_reason`, `kind`.

```sql
create unique index goals_one_active_per_area
  on goals (circle_id, user_id, area_id)
  where status = 'active' and deleted_at is null;
```

Three deliberate deviations from the brief:

- **`user_id`, not `member_id`.** Every table in this schema keys members as
  `user_id`. A second name for the same concept would be the only inconsistency
  in the database.
- **`goals.target` survives only for `goal_source = 'health_steps'`**, where it
  is the device threshold. Manual goals ignore it. `progress` is dropped once
  step sync is rewritten.
- **`deleted_at` participates in the unique index**, because this app
  soft-deletes (migration 0019) and a deleted goal must not block its
  replacement.

### `kind` — why the table is a commitment

`kind` defaults to `'habit'` and exists so that challenges, reading plans,
savings plans and training plans can later share this table rather than each
inventing a parallel one. Combined with `started_at` / `ended_at` /
`ended_reason`, that is what makes the entity a commitment. The property comes
from the lifecycle and the discriminator, not from the identifier — which is why
the table keeps its name and the UI keeps saying "goal", the friendlier word.

### RLS

Mirrors the established circle-scoped pattern: read if `is_circle_member`,
insert/update only rows where `user_id = auth.uid()`. `goal_checkins` and
`goal_history` follow their parent goal's circle. `circle_areas` is writable by
owners and admins only.

## 3. `showing_up` — the single primitive

`src/lib/showingUp.ts`, a pure module in the shape of `daylight.ts`,
`needsAttention.ts` and `gardenGrowth.ts`:

```ts
isShowingUp(goal, checkins, now): boolean
streak(goal, checkins, now): number                       // periods, not days
weeklyConsistency(goal, checkins, now): { done: number; of: number }
```

All evaluation is in device-local time. **Weeks start Monday** — a new shared
constant, since nothing in the codebase currently defines a week boundary
(weekly recap works on rolling windows).

| Cadence | `isShowingUp` |
| --- | --- |
| `daily` | a check-in exists for today |
| `times_per_week` | `done + days_remaining_in_week >= target_count` — true until the target becomes arithmetically unreachable, then false for the remainder of that week |
| `specific_weekdays` | every scheduled weekday already elapsed this week has a check-in |
| `monthly` | `done >= target_count`, or enough days remain in the month to still reach it |

**Streak** counts consecutive successful *periods* — days for `daily`, weeks for
`times_per_week` and `specific_weekdays`, months for `monthly`. Rendered 🔥N
where N is periods: a weekly goal at 🔥12 means twelve consecutive weeks, not 84
days.

**Weekly consistency** is measured against the goal's own denominator — `5/7`
for a daily goal, `4/4` for a 4×/week goal. Never a fixed /7.

**Raw check-in counts are never rolled up.** Every circle-level number counts
*members who are showing up for their own cadence*.

### Keeping TypeScript and SQL honest

A SQL view `goal_showing_up` restates these rules for `daily-digest` and
`check-streaks-at-risk`, which run in Deno against the database. One rule in two
languages is a drift risk, mitigated by a shared fixture file — a table of
`(goal, checkins, today, expected)` cases that both the `node --test` suite and
a SQL assertion script execute. Divergence fails a test rather than quietly
corrupting a digest.

## 4. Rollups

**Per-Area:** `members showing up / members with an active goal in that Area`.

Members without a goal are **excluded from the denominator**, not counted as
failing. Otherwise enabling an Area would visibly damage the circle's numbers,
which penalises exactly the opt-in the design calls neutral.

**Circle streak:** consecutive days on which the circle recorded any check-in —
rendered as *"The circle has had activity every day for 86 days."* This replaces
the majority-threshold rule from the brief, which was mathematically elegant and
emotionally unexplainable: nobody can answer "why 18?" without reciting a
formula. Per-Area streaks were considered and rejected for the same reason — any
group-level streak needs a rule for what makes a week count for a *group*, which
relocates the unexplainable threshold rather than removing it.

The known weakness is accepted: in a seven-person circle, one daily checker-in
keeps the streak alive. It measures aliveness, not health. For a headline number
in an app with no competition, that is the correct thing to measure, and it
cannot shame anyone.

`CIRCLE_STREAK_MAJORITY` is not implemented. If a health-style metric is wanted
later, it arrives with its own explanation.

## 5. UI

### Circle tab

Circle activity streak, then one row per enabled Area
(`❤️ Health — 5 of 7 showing up`), with the existing cards (health, Circle
Today, members, buddy, challenges, recap) demoted beneath. The Area rows lead.

### Area detail (new screen, pushed from Circle)

Per-member grid: goal title, today's status, 🔥streak, weekly consistency.
Members without a goal render a neutral **"No goal yet"** row in
`textSecondary` — no red, no warning glyph, no sort penalty. "Previous Goals"
from `goal_history` sits below.

### Manage Areas (Circle Settings)

Owners and admins toggle Areas from the fixed catalog. **Disabling an Area does
not archive its goals** — it drops the Area from rollups and leaves the goals
dormant, so re-enabling restores everything. Destroying members' commitments as
a side effect of a settings toggle would be the most damaging action in the app.

### Goal create / edit

Enabled Area → freetext title → cadence + params. The numeric target field is
**deleted**, along with the `!!Number(target)` save gate at
`GoalsScreen.tsx:286` (which currently makes it impossible to save "Meditate"
without inventing a number) and the resulting meaningless `0 / 4` progress bar.
The cadence is the target; quantity, where it exists, lives in the title —
"Walk 10,000 steps".

Replacing a goal within an Area archives the old one to `goal_history` with its
`best_streak` and `ended_reason = 'replaced'`, and **resets the streak to 0** —
it is a new commitment. The confirmation states this plainly, in a themed
`ActionSheet`. Never `Alert.alert`: Android silently keeps only
`buttons.slice(0, 3)` and hardcodes `cancelable: false`, which is how the
streak-save prompt became inescapable.

### Finishing and deleting

Two distinct endings, both returning the Area to "No goal yet":

- **"I've finished this"** archives with `ended_reason = 'completed'`. This
  action is included in V1 because without it nothing in the model can ever be
  completed — a cadence goal is open-ended and has no finish line — and future
  insights like *"You've completed 14 commitments"* would be unbuildable.
- **Delete** archives with `ended_reason = 'deleted'`. Choosing not to
  participate in an Area for now is not a failure and is never rendered as one.

A goal deleted with **zero check-ins writes no history at all**. Nothing
happened; there is nothing to remember.

### Feed

Encouragement only — no leaderboards, no rankings. Adds `goal_checked_in`,
`streak_milestone`, `streak_restarted`, `everyone_checked_in`. The
`goal_started` event already exists and already fires on creation; it needs only
the Area added to its payload so the feed can say "started a new **Health**
goal — *Train for a half marathon*".

### Onboarding

New circles enable **Health, Learning, Finance**. Copy: *"Pick one goal for each
area. You can skip any area and add one later."* Never blocking.

## 6. Consumers that must change

This is the bulk of the work; ~45 files read goals today.

- **Garden** (`useGarden.ts`) derives stage entirely from `streak_count` and
  `last_logged_date`, both of which change meaning. It re-derives from
  `isShowingUp` plus period streaks. Its `wilted` threshold must stay in
  agreement with `needsAttention.ts` — the existing code comments already warn
  that these two drifting apart produces contradictory screens.
- **`needsAttention`, `weeklyHighlight`, `CircleAICard`, `TodayGoalsChecklist`,
  `useProfileStats`, `useLifeTimeline`** move onto the new primitive.
- **`sync_step_goal`** stops computing its own streak and instead inserts a
  `goal_checkins` row when the device crosses the threshold. Device and manual
  goals then reduce to identical check-in rows, so every downstream metric
  treats them the same.
- **Taxonomy:** `suggestions.ts` re-catalogued to 8 Areas, `profiles.interests`
  migrated, `PillarIcons` extended with Mind, Career and Community. These render
  as drawn icons in the existing style; the catalog emoji are seed data, not the
  rendered UI.

## 7. Migration

One schema migration plus one backfill.

1. Seed the 8 `areas`.
2. For each circle, enable Health / Learning / Finance plus any Area implied by
   its existing goals.
3. Map categories: `health→Health`, `wealth→Finance`, `ideas→Creativity`,
   `learning→Learning`, `relationships→Family`. `category IS NULL` or `'misc'`
   archives to `goal_history` with `ended_reason = 'migration'` and
   `needs_review = true`.
4. Per `(user_id, area_id)`, the goal with the latest `last_logged_date` stays
   active; the rest archive with `needs_review = true`, satisfying the unique
   index from the first moment it exists.
5. All migrated goals get `target_type = 'daily'`. `started_at` is left as the
   value 0046 already backfilled from `created_at` - each goal's real origin -
   rather than re-stamped to the migration date: nothing in the app reads
   `started_at` to judge showing-up (`isShowingUp` never looks at it), and
   `streak()` reads only the check-in ledger, which starts empty for every
   migrated goal regardless of the date stored here, so re-stamping it would
   only destroy history for no behavioral benefit. `streak_count` is
   preserved as-is.

Nothing is deleted. The `needs_review` count is queryable after deploy, and
those goals surface in the member's Previous Goals rather than vanishing.

## 8. Testing

- Unit tests for `showingUp.ts` across all four cadences: period boundaries,
  the unreachable-target transition for `times_per_week`, partial weeks for
  `specific_weekdays`, month-end for `monthly`, and streak resets.
- The shared fixture set executed against both the TS module and the SQL view.
- Migration tested against a snapshot containing: multiple goals per area,
  null categories, `misc`, zero-check-in goals, and `health_steps` goals.

## 9. Out of scope

- Sub-goals or multiple goals per Area.
- Any comparison, scoring or ranking between different members' goals.
- Member-created Areas.
- **Seasons.** The model is compatible, but not sufficient as designed:
  `goal_history` covers the archive, while `circle_areas` would need a
  `season_id`, since a circle enabling Health in September and again in October
  is currently one row rather than two. Recorded here so the later migration is
  expected rather than surprising.

## 10. Sequencing

Too large to land at once. Suggested phases:

1. Schema + `showingUp.ts` + fixtures (no UI).
2. Migration and backfill.
3. Circle tab rollup, Area detail, Manage Areas, goal create/edit.
4. Consumer rewrites (garden, needsAttention, digest, step sync, taxonomy).

## Open question for implementation

`AGENTS.md` instructs reading the Expo v57 docs, but `package.json` pins Expo
`^54.0.36`. This design assumes Expo 54 APIs. If an upgrade is in flight, the UI
phase should be sequenced after it.
