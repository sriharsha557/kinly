# Notifications design — awareness in the app, action on the phone

**Date:** 2026-07-31
**Status:** Approved design, ready for implementation planning

## Terminology

These two are different things, and this document never uses "notification" alone to mean either.

**Push Notification** — an OS-level notification on the phone, arriving even when Kinly is closed or backgrounded. Reserved for things that need someone now: *"Priya needs your support."* / *"Your streak ends today."* / *"Your join request was approved."*

**Moments Feed** — the in-app activity feed, visible only inside Kinly. Where everything lands, urgent or not: goal completed, friend checked in, garden grew, challenge completed.

Every event appears in the Moments Feed. A Push Notification is a deliberate promotion out of it, never the default.

## Problem

Kinly has exactly one delivery mechanism, and it makes no distinction between the two. A row lands in `events`, a Supabase
Database Webhook fires, and `notify-circle` pushes it to every active circle member
except the actor. The same row is also the in-app Circle Activity feed. Feed entry
and phone interruption are therefore the same decision — there is no way to show
something in the app without buzzing everyone's phone.

The consequence is volume. Mood check-ins alone are a daily ritual for every member,
so in a five-person circle each person receives four pushes a day before anything
else happens. Adding streak-at-risk reminders, goal completions, streak milestones,
nudges and asks puts a healthy circle at roughly **5–10 pushes per person per day**.

That is the range where users do not tune preferences — they disable Push Notifications at
the OS level, permanently, including the ones that mattered. For a product whose
differentiator is *not being another chat app*, training users to mute it is fatal.

A second flaw: muting is per event *type*, but whether something deserves attention
often depends on the *payload*. The existing copy already knows this — a "tough day"
check-in reads "send some encouragement?" while a great one reads "X is having a great
day!". One is a call to action, the other is ambient. Today they share one toggle.

## Governing principle

> **The app is for awareness. The phone is for action.**

And the test that decides every case, now and in future:

> **If the user ignores this until tomorrow, did someone suffer?**
> Yes → Push Notification. No → Moments Feed only.

Everything lands in the feed. Pushing is a deliberate promotion out of it, not the
default. This is the inverse of today's behaviour.

## Three buckets

### 1. Immediate (phone push)

Sent only when a person is expected to act now.

| Trigger | Source | Recipients |
|---|---|---|
| Nudge sent to you | `nudges` INSERT | The nudged member |
| Reply to your ask | `ask_replies` INSERT | Ask author |
| Ask posted | `events` type `ask` | Circle (minus author) |
| **Tough-day check-in** | `events` type `mood_checkin`, `payload.mood = 'tough'` | Circle (minus author) |
| Your streak ends today | `events` type `reminder` | **Goal owner only** |
| Buddy's streak ends today | `events` type `reminder` | **That member's buddy only** |
| Buddy checked in on you | `events` type `buddy_checkin` (new) | The buddy being checked on |
| Join request | `circle_members` INSERT, status `pending` | Owner + admins |
| Join approved | `circle_members` UPDATE `pending`→`active` | The joiner |
| *(reserved)* Support requested | `events` type `support_requested` | Circle — **see Out of scope** |

The mood-check-in row is the payload-conditional case: `tough` pushes, `great` and
`okay` do not.

### 2. Daily digest (one phone push, 13:30 UTC / 19:00 IST)

A single composed summary per circle per day. Not an exhaustive list — a curated
highlight reel, capped at **three lines plus an "and N more" tail**, selected in this
priority order:

1. Streak milestones
2. Goal completions
3. Garden growth
4. Check-in participation, aggregated ("Everyone checked in today 🎉" / "3 friends checked in")

Example:

```
🌱 Today in Bloom Circle
• Priya completed "Run 5km"
• Rahul reached a 10-day streak
• Everyone checked in today 🎉
```

Tapping opens the Moments feed. If a circle produced no digest-worthy activity, **no
digest is sent** — an empty digest is itself noise.

### 3. Moments (in-app feed, never pushes)

Every event lands here regardless of tier, including the immediate ones. Types:

**Existing:** `goal_completed`, `streak`, `reminder`, `ask`, `challenge_completed`,
`mood_checkin`, `streak_saved`, `progress_photo`

**New in v1:** `goal_started`, `achievement_unlocked`, `garden_grew`, `buddy_checkin`

**Explicitly excluded:** profile updates. A changed avatar is not a moment, and mixing
it in dilutes the meaning the feed exists to protect.

## Naming

The activity feed becomes **Moments** — a timeline of the circle's journey rather than
a list of Push Notifications.

This collides with `ConnectionScreen`, whose title is "Connection Moments" and whose
tab label is currently "Moments". That tab (asks, Would You Rather, Guess Who) is
renamed to **Together**.

| Surface | Before | After |
|---|---|---|
| Today's activity feed heading | Circle Activity | Moments |
| Fifth tab label | Moments | Together |
| `ConnectionScreen` title | Connection Moments | Together |

Route names (`Connection` in `MainTabParamList`) stay unchanged — this is a display
rename only, so deep links and navigation types are unaffected.

## Unread state

Without this, quiet tiers feel like nothing happened.

- Add `circle_members.last_read_events_at timestamptz` (nullable; null = never read).
- The Today screen stamps it to `now()` **on screen focus** (React Navigation's
  `useFocusEffect`), not on scroll — arriving at the screen counts as reading.
- The Home tab shows a dot when events newer than the stamp exist, **excluding the
  viewer's own events**; your own actions never mark your feed unread.
- The feed draws a "New" divider at the boundary.

Per (user, circle), matching how the rest of circle-scoped state is keyed.

## Member controls

Replace nine flat toggles with two headline switches, with the existing nine moved
under an "Advanced" disclosure:

- **Personal alerts** — when someone needs you (the immediate tier)
- **Daily digest** — your circle's day in one message

Precedence: a tier switched off silences that tier entirely; switched on, the
per-category mutes apply as they do today.

**Circle management is exempt.** Join requests and approvals ignore both switches and
all category mutes, matching today's behaviour where `notify-circle` assigns them the
`membership` category deliberately kept out of the mute UI. Missing "you're in!" or an
unanswered join request strands a real person, so these stay unmutable.

**No schema change.** `notification_mutes.category` is free text, so the tier switches
store as `tier_immediate` / `tier_digest` rows in the existing table. Settings stay
per member per circle — nobody can force noise on anyone else, and nobody can silence
something another member needs.

## Delivery

### `notify-circle` (modified)

Gains a tier map keyed by table + event type, consulted before any push:

- Immediate → push, with the corrected recipient rules in the table above
- Anything else → return early. The row is already in `events`, so the feed is
  unaffected and no push is sent.

### `daily-digest` (new edge function)

Runs on pg_cron at 13:30 UTC. For each circle: read the last 24h of `events`, drop
immediate-tier rows, compose the summary per the priority order above, and send one
push per member who has not muted `tier_digest`. Reads from `events` — **no new table
is needed** to accumulate digest content.

Fixed UTC time matches the precedent set by `0016_streak_at_risk_cron.sql`, which
documents itself as "an approximation, not per-user timezone-aware". Per-user
timezones are the upgrade path when Kinly expands beyond one region.

### Garden growth events

Stage is derived live in `useGarden.stageFor()` from max streak and recency
(wilted / seed ≥0 / sprout ≥3 / tree ≥14 / bloom ≥30) and never persisted. Because
the thresholds are fixed and `useLogGoalWithCelebration` already computes the updated
streak count, a stage advance is detectable **at log time** — no persisted stage and
no diffing job. Emit `garden_grew` when a log pushes the member's *maximum* streak
across all their goals over a threshold, with the new stage in the payload.

**Growth only, never wilting.** Wilting is a passage of time rather than an action, so
it would need a scheduled sweep — and `MoodCheckinCard` establishes an explicit "No
shame mechanics" rule this design follows.

## Schema changes

1. `circle_members.last_read_events_at timestamptz` — new column
2. `event_type` enum gains `goal_started`, `achievement_unlocked`, `garden_grew`,
   `buddy_checkin` (pattern of `0015`: `alter type … add value if not exists`)
3. pg_cron entry for `daily-digest` at 13:30 UTC
4. No change to `notification_mutes`

## Bugs fixed as part of this

**Buddy check-in broadcasts to the wrong people.** `useCheckInOnBuddy` inserts an
`events` row of type `reminder` with `user_id` set to the *buddy*. `notify-circle`'s
events branch then reads the actor's name from `user_id` and notifies everyone except
that user — so a private 1:1 gesture pushes *"[Buddy] could use a nudge: Your buddy is
checking in on you"* to the whole circle, **including the sender, about their own
action**. Fixed by the dedicated `buddy_checkin` type routed only to the buddy.

**Streak-at-risk fans out to the whole circle.** `check-streaks-at-risk` inserts a
`reminder` event that notifies every other member. Narrowed to the goal owner plus
their buddy. This is an intentional reduction in reach, recorded here so it is not
later read as a regression.

## Manual deployment steps

Database Webhooks are configured by hand in the Supabase Dashboard, not in code. The
existing five (INSERT on `events` / `nudges` / `ask_replies`, INSERT and UPDATE on
`circle_members`) continue to serve the immediate tier — **no new webhooks are
required**, since tier filtering happens inside `notify-circle`. The new `daily-digest`
function needs deploying and its pg_cron entry creating.

## Out of scope

- **"I need support" button.** An explicit one-tap "I'm struggling" action, distinct
  from asks and mood check-ins. A real feature needing its own UI, placement and
  anti-abuse thinking. This design **reserves its tier slot** (`support_requested`,
  immediate, to the circle) so it can land later without reopening this spec.
- **Weekly summary as a feed event.** Initially planned for v1 on the assumption it
  was a cheap insert. It is not: `weekly-recap` is an on-demand AI call triggered by
  opening the Circle tab, not a scheduled job, so nothing produces a weekly artifact
  to insert. Emitting one would need a new weekly cron — and would duplicate
  `WeeklyRecapCard`, which already gives the recap a home on the Circle tab.
- **Quiet hours.** At 1–3 pushes a day, all personal and wanted, a quiet window adds
  scheduling complexity and a "why wasn't I told?" support burden for a problem the
  tiering already solves.
- **Per-user timezones.** See Delivery.
- **Profile-update events.** See Moments.

## Success criteria

- A member of a five-person circle receives **1–3 pushes on a normal day**, down from 5–10.
- Every immediate push either names the recipient personally or is the single digest.
- No event disappears — everything remains discoverable in Moments, with unread state
  signalling that something is waiting.
- A user who ignores every push for a day misses nothing that hurt anyone.
