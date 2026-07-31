# Notification Tiering and Daily Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut a five-person circle from 5–10 pushes per person per day to 1–3 by making `notify-circle` push only the immediate tier, adding a single daily digest, and fixing the two recipient bugs — without any event disappearing from the Moments feed.

**Architecture:** A pure `tierFor()` function (unit-tested with `node:test`) decides push vs feed-only; `notify-circle` consults it and returns early for feed-only rows, which are already in `events` and therefore already in the feed. Recipient selection moves from one shared `title`/`body` to a list of *deliveries*, because a streak-at-risk reminder must say different things to the goal owner and to their buddy. A new `daily-digest` edge function on pg_cron composes one summary per circle from the last 24h of `events` — no new table. Four new `event_type` enum values give the feed the vocabulary the spec asks for.

**Tech Stack:** Deno edge functions on Supabase, Postgres (enum + pg_cron), React Native (Expo SDK 54) + TypeScript client, React Query, `node:test` with `--experimental-strip-types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-31-notifications-design.md` governs all behaviour here. Plan 1 (`2026-07-31-moments-foundation.md`) is a hard prerequisite — it ships the awareness layer that makes quieting safe.
- **Governing test for every tier decision:** *If the user ignores this until tomorrow, did someone suffer?* Yes → push. No → feed.
- **No event may stop reaching the feed.** This plan only changes *pushing*. Every branch that stops pushing must return early, never skip the `events` insert.
- **Circle management is exempt from all muting.** Join requests and approvals ignore `tier_immediate`, `tier_digest`, and every category mute — the existing `membership` category stays out of the mute UI.
- **Migrations are sequential.** The next numbers are `0039` and `0040`.
- **Migrations and edge-function deploys are done by hand** in the Supabase Dashboard. This repo has no Supabase CLI step.
- **Edge functions are deployed by pasting files into the Dashboard editor.** The editor supports multiple files per function; if you hit a single-file editor, inline the imported `tiers.ts` / `digest.ts` at the top of `index.ts` and drop the `import` line — both are self-contained with no imports of their own.
- **No raw hex in components.** All colour comes from `useTheme()` tokens (`design/PRINCIPLES.md`); the 13px type floor applies to any new copy.
- **Verification commands:** `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three clean before a task is committed. `tsconfig.json` excludes `supabase/functions`, so edge-function code is covered by `npm test` and review, not by `tsc`.
- **Node version:** 22.16.0 local.
- **Test imports use the explicit `.ts` extension** (`from './tiers.ts'`) — Node ESM performs no extension resolution. `allowImportingTsExtensions` is already set (Plan 1, Task 1).

## Deviations from the spec, decided here

1. **`buddy_checkin` is feed-only, not immediate.** The spec routes it to the buddy as an immediate push. But `useCheckInOnBuddy` inserts a `nudges` row alongside the event, and `nudges` is already immediate and already routed to exactly that one person — with better, AI-generated copy. Pushing both would double-notify. Net effect matches the spec's intent (the buddy gets one push); the tier map records the reason.
2. **`achievement_unlocked` gets the enum value, type, icon and feed copy, but no emitter.** Every `useCreateAchievement` call site in the app (`useLogGoalWithCelebration` ×2, `useSyncStepGoals` ×2, `ChallengesCard` ×1) already emits a `goal_completed`, `streak`, or `challenge_completed` event for the same moment. Adding an emitter would duplicate every one of those rows in the feed. The vocabulary lands so a future unpaired achievement can use it; nothing emits it today.

---

### Task 1: Tier decision module

The single highest-stakes piece of logic in this plan — get it wrong and people stop receiving things they needed. It is therefore pure, dependency-free, and unit-tested before anything consumes it.

**Files:**
- Create: `supabase/functions/notify-circle/tiers.ts`
- Create: `supabase/functions/notify-circle/tiers.test.ts`
- Modify: `package.json` (widen the `test` glob)

**Interfaces:**
- Consumes: nothing
- Produces: `type Tier = 'immediate' | 'feed'` and `tierFor(table: string, eventType: string | undefined, payload: Record<string, unknown>): Tier`

- [ ] **Step 1: Widen the test glob**

In `package.json`, replace the `test` script with:

```json
"test": "node --experimental-strip-types --test \"src/**/*.test.ts\" \"supabase/functions/**/*.test.ts\""
```

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/notify-circle/tiers.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierFor } from './tiers.ts';

test('nudges always push - they name one person', () => {
  assert.equal(tierFor('nudges', undefined, {}), 'immediate');
});

test('ask replies always push - the author is waiting', () => {
  assert.equal(tierFor('ask_replies', undefined, {}), 'immediate');
});

test('membership rows always push', () => {
  assert.equal(tierFor('circle_members', undefined, {}), 'immediate');
});

test('an ask pushes to the circle', () => {
  assert.equal(tierFor('events', 'ask', {}), 'immediate');
});

test('a streak-at-risk reminder pushes', () => {
  assert.equal(tierFor('events', 'reminder', {}), 'immediate');
});

test('a tough-day check-in pushes', () => {
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'tough' }), 'immediate');
});

test('an okay or great check-in does not push', () => {
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'okay' }), 'feed');
  assert.equal(tierFor('events', 'mood_checkin', { mood: 'great' }), 'feed');
});

test('a check-in with no mood in the payload does not push', () => {
  assert.equal(tierFor('events', 'mood_checkin', {}), 'feed');
});

test('celebrations are feed-only', () => {
  assert.equal(tierFor('events', 'goal_completed', {}), 'feed');
  assert.equal(tierFor('events', 'streak', {}), 'feed');
  assert.equal(tierFor('events', 'challenge_completed', {}), 'feed');
  assert.equal(tierFor('events', 'streak_saved', {}), 'feed');
  assert.equal(tierFor('events', 'progress_photo', {}), 'feed');
});

test('the four new types are feed-only', () => {
  assert.equal(tierFor('events', 'goal_started', {}), 'feed');
  assert.equal(tierFor('events', 'achievement_unlocked', {}), 'feed');
  assert.equal(tierFor('events', 'garden_grew', {}), 'feed');
  assert.equal(tierFor('events', 'buddy_checkin', {}), 'feed');
});

test('an unknown event type is feed-only, never a surprise push', () => {
  assert.equal(tierFor('events', 'something_new', {}), 'feed');
  assert.equal(tierFor('events', undefined, {}), 'feed');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './tiers.ts'`

- [ ] **Step 4: Write the implementation**

Create `supabase/functions/notify-circle/tiers.ts`:

```ts
// Which rows earn a phone push (docs/superpowers/specs/2026-07-31-
// notifications-design.md). The test that decides every case: "if the user
// ignores this until tomorrow, did someone suffer?" Yes -> immediate. No ->
// feed. Feed-only is the default, including for event types this file has
// never heard of - a new type must be added here deliberately, and the
// failure mode of forgetting is a missing push, not a surprise one.
//
// Deliberately dependency-free: imported by notify-circle under Deno and by
// node:test under --experimental-strip-types, neither of which should have
// to resolve anything else to answer this question.

export type Tier = 'immediate' | 'feed';

// events.type values that name a person who is expected to act now.
// mood_checkin is absent because it is payload-conditional - see below.
const IMMEDIATE_EVENT_TYPES = new Set([
  'ask',
  // events.user_id on a reminder is the goal owner, not an actor - the row
  // is *about* them. Recipients are the owner and their buddy; see index.ts.
  'reminder',
]);

export function tierFor(
  table: string,
  eventType: string | undefined,
  payload: Record<string, unknown>,
): Tier {
  // A nudge and an ask reply each name exactly one waiting person, and a
  // membership row either strands a joiner or leaves a request unanswered.
  if (table === 'nudges' || table === 'ask_replies' || table === 'circle_members') {
    return 'immediate';
  }
  if (table !== 'events') return 'feed';

  // The payload-conditional case the spec calls out: the existing copy
  // already knows a tough day is a call to action while a great one is
  // ambient. Now they get different tiers rather than one shared toggle.
  if (eventType === 'mood_checkin') {
    return payload.mood === 'tough' ? 'immediate' : 'feed';
  }

  // buddy_checkin is deliberately NOT immediate even though the spec's tier
  // table lists it. useCheckInOnBuddy inserts a nudges row alongside the
  // event, and nudges is already immediate and already routed to exactly
  // that one person with better (AI-generated) copy. Pushing both would
  // double-notify the buddy for a single gesture.
  return eventType !== undefined && IMMEDIATE_EVENT_TYPES.has(eventType) ? 'immediate' : 'feed';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 6 tests from `src/lib/moments.test.ts` plus 11 here, `# fail 0`

- [ ] **Step 6: Commit**

```bash
git add package.json supabase/functions/notify-circle/tiers.ts supabase/functions/notify-circle/tiers.test.ts
git commit -m "Add tested notification tier map: feed by default, push by exception"
```

---

### Task 2: Migration — four new event types

**Files:**
- Create: `supabase/migrations/0039_moments_event_types.sql`

**Interfaces:**
- Produces: `event_type` enum values `goal_started`, `achievement_unlocked`, `garden_grew`, `buddy_checkin`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0039_moments_event_types.sql`:

```sql
-- New Moments vocabulary (docs/superpowers/specs/2026-07-31-notifications-
-- design.md). Follows 0015/0023/0025/0026's pattern of extending the enum
-- in place rather than replacing it. All four are feed-only tiers - none of
-- them pushes - so this migration is safe to apply before the matching
-- notify-circle deploy.
--
-- achievement_unlocked has no emitter yet, deliberately: every
-- useCreateAchievement call site in the app already emits goal_completed,
-- streak or challenge_completed for the same moment, so emitting this one
-- too would duplicate every celebration in the feed. The value exists so a
-- future unpaired achievement has somewhere to land.
alter type event_type add value if not exists 'goal_started';
alter type event_type add value if not exists 'achievement_unlocked';
alter type event_type add value if not exists 'garden_grew';
alter type event_type add value if not exists 'buddy_checkin';
```

- [ ] **Step 2: Apply it**

Paste the file contents into Supabase Dashboard → SQL Editor → Run.
Expected: `Success. No rows returned`

Note: Postgres cannot add an enum value and use it in the same transaction. The SQL Editor runs each statement in its own transaction, so this is fine — but do not wrap these in an explicit `begin`/`commit` alongside anything that inserts one of the new types.

- [ ] **Step 3: Verify the values exist**

Run in the SQL Editor:

```sql
select enumlabel from pg_enum
where enumtypid = 'event_type'::regtype
order by enumsortorder;
```

Expected: the original eight labels plus `goal_started`, `achievement_unlocked`, `garden_grew`, `buddy_checkin`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0039_moments_event_types.sql
git commit -m "Add goal_started, achievement_unlocked, garden_grew, buddy_checkin event types"
```

---

### Task 3: `notify-circle` — tier gate, per-recipient deliveries, fixed reminder routing

This is the task that actually reduces volume, and it fixes the streak-at-risk fan-out bug. The structural change: one shared `title`/`body` becomes a list of *deliveries*, because a streak-at-risk reminder must read as "your streak is at risk" to the goal owner and "your buddy's streak is at risk" to their buddy.

**Files:**
- Modify: `supabase/functions/notify-circle/index.ts`

**Interfaces:**
- Consumes: `tierFor` from `supabase/functions/notify-circle/tiers.ts` (Task 1)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add the import**

At the top of `supabase/functions/notify-circle/index.ts`, directly under the existing `createClient` import:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { tierFor } from './tiers.ts';
```

- [ ] **Step 2: Trim `EVENT_MESSAGES` to the types that still push**

Only `ask` and `mood_checkin` reach this map now — everything else returns early at the tier gate, and `reminder` gets per-recipient copy built inline. Replace the whole `EVENT_MESSAGES` const with:

```ts
// Only the event types that still earn a push need copy here. Celebrations
// (goal_completed / streak / challenge_completed / streak_saved /
// progress_photo) and the four Moments-only types return early at the tier
// gate, so their old entries were dead code and are gone. 'reminder' is
// absent too: it needs different copy per recipient, built in the events
// branch below.
const EVENT_MESSAGES: Record<string, (actorName: string, payload: Record<string, unknown>) => string> = {
  ask: (name, payload) => `${name} asked: "${payload.question ?? ''}"`,
  mood_checkin: (name) => `${name} is having a tough day — send some encouragement?`,
};
```

Note the `mood_checkin` entry no longer branches on mood: only `tough` reaches it now.

- [ ] **Step 3: Replace the single title/body with a delivery list**

Replace these five declarations:

```ts
    let title = 'Kinly';
    let body = '';
    let recipients: string[] = [];
    let circleId = '';
    let category = '';
```

with:

```ts
    // One push text per recipient group. A streak-at-risk reminder goes to
    // two groups with different copy ("your streak" vs "your buddy's
    // streak"), which a single shared title/body could not express.
    const deliveries: { recipients: string[]; title: string; body: string }[] = [];
    let circleId = '';
    let category = '';
```

- [ ] **Step 4: Replace the `events` branch**

Replace the whole `if (table === 'events') { ... }` block — from the line `if (table === 'events') {` down to **and including** the line `} else if (table === 'nudges') {` (the replacement below re-emits that line as its last line, so the `nudges` branch stays attached) — with:

```ts
    if (table === 'events') {
      circleId = record.circle_id as string;
      const subjectId = record.user_id as string;
      const type = record.type as string;
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      category = categoryFor(table, type);

      // The volume fix: everything lands in the feed via the events row
      // that triggered this webhook, and pushing is a deliberate promotion
      // out of it. Returning here leaves the feed completely unaffected.
      if (tierFor(table, type, payload) === 'feed') return new Response('feed only');

      const { data: subject } = await supabase.from('profiles').select('name').eq('id', subjectId).single();
      const subjectName = (subject?.name as string) ?? 'Someone';

      if (type === 'reminder') {
        // events.user_id on a reminder is the goal *owner* - the row is
        // about them, not by them. This branch used to fall through to the
        // generic "notify every active member except user_id", which sent
        // "X could use a nudge" to the whole circle and to nobody who could
        // act on it. Narrowed to the owner plus their buddy; the spec
        // records this as an intentional reduction in reach.
        // buddy_pairs is one-directional (migration 0011): a row
        // (user_id: A, buddy_id: B) means A picked B to watch, not the
        // reverse. So the people to nudge about subjectId's at-risk streak
        // are the rows pointing AT subjectId. The primary key is
        // (circle_id, user_id), so buddy_id isn't unique - several members
        // can watch the same person, and all of them should hear about it.
        const { data: watchers } = await supabase
          .from('buddy_pairs')
          .select('user_id')
          .eq('circle_id', circleId)
          .eq('buddy_id', subjectId);

        // payload.message is already written in the second person by
        // check-streaks-at-risk ("Your 5-day streak on X is at risk..."),
        // so it needs no wrapping for the owner.
        deliveries.push({
          recipients: [subjectId],
          title: 'Kinly',
          body: (payload.message as string) ?? 'Your streak is at risk — log progress today!',
        });

        const watcherIds = (watchers ?? [])
          .map((w) => w.user_id as string)
          .filter((id) => id !== subjectId);
        if (watcherIds.length > 0) {
          deliveries.push({
            recipients: watcherIds,
            title: 'Kinly',
            body: `${subjectName}'s streak is at risk — nudge them?`,
          });
        }
      } else {
        // ask and tough-day mood_checkin: the circle, minus the actor.
        // Pending members (migration 0022) can't see anything circle-scoped
        // yet, so they must not be notified about it either.
        const { data: members } = await supabase
          .from('circle_members')
          .select('user_id')
          .eq('circle_id', circleId)
          .eq('status', 'active');
        deliveries.push({
          recipients: (members ?? []).map((m) => m.user_id as string).filter((id) => id !== subjectId),
          title: 'Kinly',
          body: (EVENT_MESSAGES[type] ?? (() => `${subjectName} has an update`))(subjectName, payload),
        });
      }
    } else if (table === 'nudges') {
```

- [ ] **Step 5: Convert the four remaining branches to `deliveries.push`**

In the `nudges` branch, replace:

```ts
      title = `${(sender?.name as string) ?? 'A friend'} sent you a nudge`;
      body = (record.message as string) ?? 'Sending you encouragement!';

      const recipientId = event.user_id as string;
      recipients = recipientId !== record.from_user_id ? [recipientId] : [];
```

with:

```ts
      const recipientId = event.user_id as string;
      deliveries.push({
        recipients: recipientId !== record.from_user_id ? [recipientId] : [],
        title: `${(sender?.name as string) ?? 'A friend'} sent you a nudge`,
        body: (record.message as string) ?? 'Sending you encouragement!',
      });
```

In the `ask_replies` branch, replace:

```ts
      title = `${(replier?.name as string) ?? 'Someone'} replied`;
      body = record.body as string;

      const recipientId = post.user_id as string;
      recipients = recipientId !== record.user_id ? [recipientId] : [];
```

with:

```ts
      const recipientId = post.user_id as string;
      deliveries.push({
        recipients: recipientId !== record.user_id ? [recipientId] : [],
        title: `${(replier?.name as string) ?? 'Someone'} replied`,
        body: record.body as string,
      });
```

In the join-request branch, replace:

```ts
      title = 'New join request';
      body = `${(joiner?.name as string) ?? 'Someone'} wants to join ${(circle?.name as string) ?? 'your circle'}`;

      const { data: approvers } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);
      recipients = (approvers ?? []).map((m) => m.user_id as string);
```

with:

```ts
      const { data: approvers } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);
      deliveries.push({
        recipients: (approvers ?? []).map((m) => m.user_id as string),
        title: 'New join request',
        body: `${(joiner?.name as string) ?? 'Someone'} wants to join ${(circle?.name as string) ?? 'your circle'}`,
      });
```

In the approval branch, replace:

```ts
      title = 'Kinly';
      body = `You're in! Welcome to ${(circle?.name as string) ?? 'the circle'}.`;
      recipients = [record.user_id as string];
```

with:

```ts
      deliveries.push({
        recipients: [record.user_id as string],
        title: 'Kinly',
        body: `You're in! Welcome to ${(circle?.name as string) ?? 'the circle'}.`,
      });
```

- [ ] **Step 6: Replace the send block with a per-delivery loop**

Replace everything from:

```ts
    recipients = await filterMuted(supabase, recipients, circleId, category);
```

down to and including the closing brace of the `for (let i = 0; i < messages.length; i += 100) { ... }` loop, with:

```ts
    for (const delivery of deliveries) {
      let recipients = delivery.recipients;

      // Circle management is exempt from every switch: missing "you're in!"
      // or an unanswered join request strands a real person. Everything
      // else clears the tier switch first, then its own category mute -
      // a tier switched off silences that tier entirely, and switched on,
      // the per-category mutes apply exactly as they did before.
      if (category !== 'membership') {
        recipients = await filterMuted(supabase, recipients, circleId, 'tier_immediate');
        recipients = await filterMuted(supabase, recipients, circleId, category);
      }
      if (recipients.length === 0) continue;

      const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
      const messages = (tokens ?? []).map((t) => ({
        to: t.token as string,
        sound: 'default',
        title: delivery.title,
        body: delivery.body,
        priority: 'high',
        channelId: 'default',
      }));

      // Expo's push API accepts at most 100 messages per request. Circles cap
      // at 10 members but a user can hold multiple device tokens, so chunk
      // defensively rather than assume.
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(chunk),
        });
        const result = (await response.json()) as {
          data?: { id?: string; status: string; message?: string; details?: { error?: string } }[];
          errors?: unknown;
        };

        // Ticket IDs land in the function's logs (Dashboard -> Edge Functions
        // -> notify-circle -> Logs) so a "did it even send?" question has an
        // answer. Receipts proper need a ~15-min-later poll, which a
        // request-scoped function can't do - but delivery failures that
        // matter (dead tokens) also surface right here in the ticket, so
        // prune those immediately instead.
        console.log('expo push tickets', JSON.stringify(result.data ?? result.errors));
        const deadTokens = chunk
          .filter((_, idx) => result.data?.[idx]?.details?.error === 'DeviceNotRegistered')
          .map((m) => m.to);
        if (deadTokens.length > 0) {
          await supabase.from('push_tokens').delete().in('token', deadTokens);
          console.log('pruned dead push tokens', deadTokens.length);
        }
      }
    }
```

The `return new Response('ok');` and the `catch` below it stay exactly as they are. The old `if (recipients.length === 0) return new Response('no recipients');` line is gone — its job is now the `continue` inside the loop.

- [ ] **Step 7: Verify the file has no leftovers**

Run: `grep -n "recipients = \[\]\|let title\|let body\|no recipients" supabase/functions/notify-circle/index.ts`
Expected: no output. Any hit means a branch from Step 5 was missed.

- [ ] **Step 8: Deploy it**

Supabase Dashboard → Edge Functions → `notify-circle` → paste `tiers.ts` and the updated `index.ts` → Deploy. If the editor is single-file, paste the body of `tiers.ts` above the `interface WebhookPayload` line and delete the `import { tierFor } from './tiers.ts';` line.

No webhook changes are needed — all five existing Database Webhooks still fire, and tier filtering happens inside the function.

- [ ] **Step 9: Smoke-test the two loud paths**

In the SQL Editor, against a test circle you can watch on a device:

```sql
-- Should NOT push to anyone (feed only). Replace both UUIDs.
insert into events (circle_id, user_id, type, payload)
values ('<circle-uuid>', '<your-user-uuid>', 'goal_completed', '{"title": "Tier test"}');

-- Should push ONLY to the goal owner and their buddy.
insert into events (circle_id, user_id, type, payload)
values ('<circle-uuid>', '<other-member-uuid>', 'reminder',
        '{"message": "Your 5-day streak on \"Tier test\" is at risk - log progress today!"}');
```

Expected: no push for the first; the second reaches only that member (and their buddy, if set) — not you. Both rows appear in Moments either way. Check Dashboard → Edge Functions → `notify-circle` → Logs: the first invocation logs no `expo push tickets` line.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/notify-circle/index.ts
git commit -m "Gate notify-circle on the tier map and route reminders to owner plus buddy"
```

---

### Task 4: Client vocabulary for the four new event types

Adding to the `EventType` union makes `EVENT_ICON`'s `Record<EventType, ...>` fail to compile until every new type has an icon — deliberate, and the reason this task is one unit.

**Files:**
- Modify: `src/types/models.ts:52-60`
- Modify: `src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `EventType` gains `'goal_started' | 'achievement_unlocked' | 'garden_grew' | 'buddy_checkin'`

- [ ] **Step 1: Extend the union**

In `src/types/models.ts`, replace:

```ts
export type EventType =
  | 'goal_completed'
  | 'streak'
  | 'reminder'
  | 'ask'
  | 'challenge_completed'
  | 'mood_checkin'
  | 'streak_saved'
  | 'progress_photo';
```

with:

```ts
export type EventType =
  | 'goal_completed'
  | 'streak'
  | 'reminder'
  | 'ask'
  | 'challenge_completed'
  | 'mood_checkin'
  | 'streak_saved'
  | 'progress_photo'
  // Moments vocabulary added by migration 0039. All four are feed-only -
  // none of them pushes (docs/superpowers/specs/2026-07-31-notifications-
  // design.md). achievement_unlocked has no emitter yet, by design: every
  // achievement the app creates already emits one of the types above.
  | 'goal_started'
  | 'achievement_unlocked'
  | 'garden_grew'
  | 'buddy_checkin';
```

- [ ] **Step 2: Confirm the typecheck now fails**

Run: `npx tsc --noEmit`
Expected: FAIL in `src/screens/TodayScreen.tsx` — `EVENT_ICON` is missing the four new keys.

- [ ] **Step 3: Add the icon imports**

In `src/screens/TodayScreen.tsx`, after the existing `import RocketIcon from '../../assets/icons/feed/rocket.svg';` line:

```tsx
import StartIcon from '../../assets/icons/feed/sprout.svg';
import CelebrateIcon from '../../assets/icons/feed/celebrate.svg';
import GalaxyIcon from '../../assets/icons/feed/galaxy.svg';
import WaveIcon from '../../assets/icons/feed/wave.svg';
```

- [ ] **Step 4: Extend `EVENT_ICON`**

Replace the `EVENT_ICON` map with:

```tsx
const EVENT_ICON: Record<EventType, FC<SvgProps>> = {
  goal_completed: CheckIcon,
  streak: StreakIcon,
  reminder: ClockIcon,
  ask: ChatIcon,
  challenge_completed: RocketIcon,
  mood_checkin: NeutralIcon,
  streak_saved: WaterIcon,
  progress_photo: CameraIcon,
  goal_started: StartIcon,
  achievement_unlocked: CelebrateIcon,
  garden_grew: GalaxyIcon,
  buddy_checkin: WaveIcon,
};
```

- [ ] **Step 5: Add the feed copy**

In `describeEvent`, add these four cases directly above the `default:` case:

```tsx
    case 'goal_started':
      return `${name} started "${payload.title ?? 'a goal'}"`;
    case 'achievement_unlocked':
      return `${name} unlocked "${payload.title ?? 'an achievement'}"`;
    case 'garden_grew': {
      const stage = payload.stage as string | undefined;
      const stageLabel =
        stage === 'bloom' ? 'is blooming' : stage === 'tree' ? 'grew into a tree' : 'sprouted';
      return `${name}'s garden ${stageLabel}`;
    }
    case 'buddy_checkin':
      return `${name}'s buddy checked in on them`;
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/types/models.ts src/screens/TodayScreen.tsx`
Expected: no output from either

- [ ] **Step 7: Commit**

```bash
git add src/types/models.ts src/screens/TodayScreen.tsx
git commit -m "Add feed icons and copy for the four new Moments event types"
```

---

### Task 5: Fix the buddy check-in broadcast

`useCheckInOnBuddy` inserts a `reminder` event with `user_id` set to the buddy. Before Task 3 that pushed *"[Buddy] could use a nudge: Your buddy is checking in on you"* to the whole circle, including the sender, about their own action. After Task 3 it would instead push a streak-at-risk-flavoured message to the buddy and *their* buddy — still wrong. The dedicated type fixes it: `buddy_checkin` is feed-only, and the paired `nudges` row carries the one push, to exactly the right person.

**Files:**
- Modify: `src/hooks/useBuddy.ts:54-64`

**Interfaces:**
- Consumes: `'buddy_checkin'` from `EventType` (Task 4)
- Produces: nothing

- [ ] **Step 1: Change the event type**

In `src/hooks/useBuddy.ts`, replace:

```ts
      const { data: event, error } = await supabase
        .from('events')
        .insert({
          circle_id: circleId,
          user_id: buddyId,
          type: 'reminder',
          payload: { message: 'Your buddy is checking in on you' },
        })
        .select()
        .single();
      if (error) throw error;
```

with:

```ts
      // user_id is the buddy being checked *on*, not the sender - the row is
      // about them, which is why this can't share the 'reminder' type. As
      // 'reminder' it fanned out to the whole circle (including the sender,
      // about their own action); 'buddy_checkin' is feed-only, and the
      // nudges row inserted below carries the single push, to the buddy.
      const { data: event, error } = await supabase
        .from('events')
        .insert({
          circle_id: circleId,
          user_id: buddyId,
          type: 'buddy_checkin',
          payload: { message: 'Your buddy is checking in on you' },
        })
        .select()
        .single();
      if (error) throw error;
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useBuddy.ts`
Expected: no output from either

- [ ] **Step 3: Verify on a device**

With two accounts in one circle: from account A, use "Check in on buddy" for account B.
Expected: B receives exactly one push (the nudge, with its generated message). A receives none. Both see one `buddy_checkin` row in Moments.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBuddy.ts
git commit -m "Fix buddy check-in broadcasting to the whole circle"
```

---

### Task 6: Emit `goal_started`

**Files:**
- Modify: `src/hooks/useGoals.ts:30-52`

**Interfaces:**
- Consumes: `'goal_started'` from `EventType` (Task 4)
- Produces: nothing

- [ ] **Step 1: Insert the event alongside the goal**

In `src/hooks/useGoals.ts`, in `useCreateGoal`'s `mutationFn`, replace:

```ts
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
```

with:

```ts
      if (error) throw error;

      // Starting a goal is a moment the circle should see - previously only
      // *finishing* one produced a feed row, so a friend planting something
      // new was invisible until they completed it. Feed-only (migration
      // 0039), so this adds a Moments row and no push. Deliberately not
      // awaited into the error path: a failed event insert must not roll
      // back a successfully created goal.
      const { error: eventError } = await supabase.from('events').insert({
        circle_id: circleId,
        user_id: userId,
        type: 'goal_started',
        payload: { title, goal_id: (data as Goal).id },
      });
      if (eventError) console.warn('goal_started event failed', eventError.message);

      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useGoals.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoals.ts
git commit -m "Emit goal_started so planting a goal shows up in Moments"
```

---

### Task 7: Emit `garden_grew` on a stage advance

Garden stage is derived live in `useGarden.stageFor()` from the member's *maximum* streak across all their goals and never persisted. Because the thresholds are fixed (3 / 14 / 30) and the log path already knows the before and after streak for the goal being logged, a stage advance is detectable at log time — no persisted stage and no diffing job. The threshold arithmetic is pure and gets unit tests; the query that turns one goal's streak into the member's max is the only part that touches the network.

**Files:**
- Create: `src/lib/gardenGrowth.ts`
- Create: `src/lib/gardenGrowth.test.ts`
- Modify: `src/hooks/useLogGoalWithCelebration.ts`

**Interfaces:**
- Consumes: `'garden_grew'` from `EventType` (Task 4)
- Produces: `type GrowthStage = 'sprout' | 'tree' | 'bloom'` and `growthStageCrossed(previousMax: number, newMax: number): GrowthStage | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gardenGrowth.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { growthStageCrossed } from './gardenGrowth.ts';

test('crossing 3 sprouts', () => {
  assert.equal(growthStageCrossed(2, 3), 'sprout');
});

test('crossing 14 grows a tree', () => {
  assert.equal(growthStageCrossed(13, 14), 'tree');
});

test('crossing 30 blooms', () => {
  assert.equal(growthStageCrossed(29, 30), 'bloom');
});

test('a streak that grows without crossing anything reports nothing', () => {
  assert.equal(growthStageCrossed(4, 5), null);
  assert.equal(growthStageCrossed(14, 15), null);
});

test('landing exactly on a threshold you were already past reports nothing', () => {
  assert.equal(growthStageCrossed(30, 30), null);
});

test('a jump past several thresholds reports only the highest reached', () => {
  assert.equal(growthStageCrossed(1, 30), 'bloom');
  assert.equal(growthStageCrossed(1, 14), 'tree');
});

test('a streak that resets reports nothing - growth only, never wilting', () => {
  assert.equal(growthStageCrossed(30, 1), null);
  assert.equal(growthStageCrossed(14, 0), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './gardenGrowth.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/gardenGrowth.ts`:

```ts
// Detects a garden stage advance at log time (docs/superpowers/specs/
// 2026-07-31-notifications-design.md). The thresholds mirror
// useGarden.stageFor() exactly - stage is derived live and never persisted,
// so this is the only way to notice a transition without a diffing job.
//
// Growth only, never wilting: wilting is a passage of time rather than an
// action, so it would need a scheduled sweep, and MoodCheckinCard's "no
// shame mechanics" rule says a garden should not announce a member's
// decline to their friends.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export type GrowthStage = 'sprout' | 'tree' | 'bloom';

const THRESHOLDS: readonly (readonly [number, GrowthStage])[] = [
  [30, 'bloom'],
  [14, 'tree'],
  [3, 'sprout'],
];

// Both arguments are the member's *maximum* streak across every goal they
// hold in the circle, before and after the log - stage follows the max, so
// beating your own second-best goal changes nothing.
export function growthStageCrossed(previousMax: number, newMax: number): GrowthStage | null {
  if (newMax <= previousMax) return null;
  const crossed = THRESHOLDS.find(([threshold]) => newMax >= threshold && previousMax < threshold);
  return crossed ? crossed[1] : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 7 new tests, `# fail 0`

- [ ] **Step 5: Wire it into the log path**

In `src/hooks/useLogGoalWithCelebration.ts`, add to the imports:

```ts
import { growthStageCrossed } from '../lib/gardenGrowth';
```

Then, in `logGoal`, directly after the `if (hitMilestone) { ... }` block and *before* the `if (wasFirstEver && !celebration)` block, insert:

```ts
    // A stage advance is a circle-visible moment, but stage follows the
    // member's max streak across all their goals - so beating this goal's
    // own record only advances the garden if this goal is the one setting
    // the pace. The query only runs when this goal's streak actually grew,
    // which is the rare case.
    if (updated.streak_count > previousStreak) {
      const { data: otherGoals } = await supabase
        .from('goals')
        .select('streak_count')
        .eq('user_id', userId)
        .eq('circle_id', circleId)
        .neq('id', goal.id);
      const otherMax = (otherGoals ?? []).reduce(
        (max, g) => Math.max(max, (g.streak_count as number) ?? 0),
        0,
      );
      const stage = growthStageCrossed(
        Math.max(otherMax, previousStreak),
        Math.max(otherMax, updated.streak_count),
      );
      if (stage) {
        await logEvent.mutateAsync({
          circleId,
          userId,
          type: 'garden_grew',
          payload: { stage, streak_count: updated.streak_count },
        });
      }
    }
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/gardenGrowth.ts src/hooks/useLogGoalWithCelebration.ts`
Expected: no output from either

- [ ] **Step 7: Commit**

```bash
git add src/lib/gardenGrowth.ts src/lib/gardenGrowth.test.ts src/hooks/useLogGoalWithCelebration.ts
git commit -m "Emit garden_grew when a log advances the member's garden stage"
```

---

### Task 8: `daily-digest` edge function

One composed summary per circle per day, replacing the pile of individual celebration pushes Task 3 silenced. The composer is pure and unit-tested; the function around it is I/O.

**Files:**
- Create: `supabase/functions/daily-digest/digest.ts`
- Create: `supabase/functions/daily-digest/digest.test.ts`
- Create: `supabase/functions/daily-digest/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface DigestEvent { type: string; user_id: string; actor_name: string; payload: Record<string, unknown> }` and `composeDigest(events: readonly DigestEvent[], activeMemberCount: number): string[] | null`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/daily-digest/digest.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeDigest, type DigestEvent } from './digest.ts';

function ev(type: string, actor_name: string, payload: Record<string, unknown> = {}, user_id = actor_name): DigestEvent {
  return { type, actor_name, payload, user_id };
}

test('an empty day produces no digest at all', () => {
  assert.equal(composeDigest([], 5), null);
});

test('a day of only immediate-tier events produces no digest', () => {
  assert.equal(composeDigest([ev('ask', 'Priya', { question: 'help?' })], 5), null);
});

test('streak milestones outrank goal completions', () => {
  const lines = composeDigest(
    [
      ev('goal_completed', 'Priya', { title: 'Run 5km' }),
      ev('streak', 'Rahul', { streak_count: 10 }),
    ],
    5,
  );
  assert.deepEqual(lines, ['Rahul reached a 10-day streak', 'Priya completed "Run 5km"']);
});

test('everyone checking in aggregates into one celebratory line', () => {
  const lines = composeDigest(
    [ev('mood_checkin', 'A'), ev('mood_checkin', 'B'), ev('mood_checkin', 'C')],
    3,
  );
  assert.deepEqual(lines, ['Everyone checked in today 🎉']);
});

test('a partial turnout counts friends instead', () => {
  const lines = composeDigest([ev('mood_checkin', 'A'), ev('mood_checkin', 'B')], 5);
  assert.deepEqual(lines, ['2 friends checked in']);
});

test('one person checking in reads in the singular', () => {
  const lines = composeDigest([ev('mood_checkin', 'A')], 5);
  assert.deepEqual(lines, ['1 friend checked in']);
});

test('the same person checking in twice counts once', () => {
  const lines = composeDigest([ev('mood_checkin', 'A', {}, 'a'), ev('mood_checkin', 'A', {}, 'a')], 5);
  assert.deepEqual(lines, ['1 friend checked in']);
});

test('a busy day caps at three lines plus a tail', () => {
  const lines = composeDigest(
    [
      ev('streak', 'A', { streak_count: 3 }),
      ev('streak', 'B', { streak_count: 7 }),
      ev('goal_completed', 'C', { title: 'Read' }),
      ev('goal_completed', 'D', { title: 'Swim' }),
      ev('garden_grew', 'E', { stage: 'tree' }),
    ],
    5,
  );
  assert.deepEqual(lines, [
    'A reached a 3-day streak',
    'B reached a 7-day streak',
    'C completed "Read"',
    'and 2 more',
  ]);
});

test('garden growth reads in the stage the member reached', () => {
  const lines = composeDigest([ev('garden_grew', 'Meera', { stage: 'bloom' })], 5);
  assert.deepEqual(lines, ["Meera's garden is blooming"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './digest.ts'`

- [ ] **Step 3: Write the composer**

Create `supabase/functions/daily-digest/digest.ts`:

```ts
// Composes one circle's daily digest (docs/superpowers/specs/2026-07-31-
// notifications-design.md). A curated highlight reel, not an exhaustive
// list: three lines plus an "and N more" tail, chosen in a fixed priority
// order so the biggest moment of the day is always the first line.
//
// Returns null for a day worth nothing - an empty digest is itself noise,
// so no push is sent at all.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface DigestEvent {
  type: string;
  user_id: string;
  actor_name: string;
  payload: Record<string, unknown>;
}

const MAX_LINES = 3;

export function composeDigest(
  events: readonly DigestEvent[],
  activeMemberCount: number,
): string[] | null {
  // Priority order from the spec: streak milestones, goal completions,
  // garden growth, then aggregated check-in participation.
  const streaks = events
    .filter((e) => e.type === 'streak')
    .map((e) => `${e.actor_name} reached a ${e.payload.streak_count ?? 0}-day streak`);

  const completions = events
    .filter((e) => e.type === 'goal_completed')
    .map((e) => `${e.actor_name} completed "${e.payload.title ?? 'a goal'}"`);

  const growth = events
    .filter((e) => e.type === 'garden_grew')
    .map((e) => {
      const stage = e.payload.stage as string | undefined;
      const label = stage === 'bloom' ? 'is blooming' : stage === 'tree' ? 'grew into a tree' : 'sprouted';
      return `${e.actor_name}'s garden ${label}`;
    });

  // Participation is one aggregated line, never one per person - a circle
  // of five checking in is a single fact, not five headlines. Counted by
  // distinct member so a second check-in the same day doesn't inflate it.
  const checkedIn = new Set(events.filter((e) => e.type === 'mood_checkin').map((e) => e.user_id));
  const participation: string[] = [];
  if (checkedIn.size > 0) {
    participation.push(
      checkedIn.size >= activeMemberCount
        ? 'Everyone checked in today 🎉'
        : `${checkedIn.size} friend${checkedIn.size === 1 ? '' : 's'} checked in`,
    );
  }

  const all = [...streaks, ...completions, ...growth, ...participation];
  if (all.length === 0) return null;
  if (all.length <= MAX_LINES) return all;
  return [...all.slice(0, MAX_LINES), `and ${all.length - MAX_LINES} more`];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 9 new tests, `# fail 0`

- [ ] **Step 5: Write the function**

Create `supabase/functions/daily-digest/index.ts`:

```ts
// One composed summary per circle per day, replacing the individual
// celebration pushes notify-circle's tier gate now suppresses
// (docs/superpowers/specs/2026-07-31-notifications-design.md).
//
// Reads the last 24h of `events` - no new table is needed to accumulate
// digest content, because every event is already in there for the feed.
//
// Deploy: Supabase Dashboard -> Edge Functions -> New function
// "daily-digest" -> paste digest.ts and this file -> Deploy -> turn OFF
// "Enforce JWT verification" (pg_cron's call carries no user JWT, same as
// check-streaks-at-risk). Schedule comes from migration 0040.
//
// Runs at a fixed 13:30 UTC (19:00 IST) for everyone rather than per-user
// local evening - the same approximation migration 0016 documents for
// check-streaks-at-risk. Per-user timezones are the upgrade path when
// Kinly expands beyond one region.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { composeDigest, type DigestEvent } from './digest.ts';

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: circles, error: circlesError } = await supabase
      .from('circles')
      .select('id, name')
      .is('deleted_at', null);
    if (circlesError) throw circlesError;

    let sent = 0;
    let skipped = 0;

    for (const circle of circles ?? []) {
      const { data: rows } = await supabase
        .from('events')
        .select('type, user_id, payload, profiles(name)')
        .eq('circle_id', circle.id)
        .gte('created_at', since);

      const events: DigestEvent[] = (rows ?? []).map((row) => ({
        type: row.type as string,
        user_id: row.user_id as string,
        actor_name: ((row.profiles as unknown as { name: string } | null)?.name) ?? 'Someone',
        payload: (row.payload ?? {}) as Record<string, unknown>,
      }));

      const { data: members } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('status', 'active');
      const memberIds = (members ?? []).map((m) => m.user_id as string);
      if (memberIds.length === 0) continue;

      // composeDigest ignores immediate-tier types on its own by only
      // reading the four it summarises, so no pre-filter is needed here.
      const lines = composeDigest(events, memberIds.length);
      if (!lines) {
        skipped++;
        continue;
      }

      const { data: mutes } = await supabase
        .from('notification_mutes')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('category', 'tier_digest')
        .in('user_id', memberIds);
      const muted = new Set((mutes ?? []).map((m) => m.user_id as string));
      const recipients = memberIds.filter((id) => !muted.has(id));
      if (recipients.length === 0) continue;

      const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
      const messages = (tokens ?? []).map((t) => ({
        to: t.token as string,
        sound: 'default',
        title: `🌱 Today in ${(circle.name as string) ?? 'your circle'}`,
        body: lines.map((line) => `• ${line}`).join('\n'),
        priority: 'high',
        channelId: 'default',
      }));
      if (messages.length === 0) continue;

      // Same 100-message chunking and dead-token pruning as notify-circle:
      // a circle caps at 10 members but each can hold several device tokens.
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(chunk),
        });
        const result = (await response.json()) as {
          data?: { id?: string; status: string; details?: { error?: string } }[];
          errors?: unknown;
        };
        console.log('digest push tickets', circle.id, JSON.stringify(result.data ?? result.errors));
        const deadTokens = chunk
          .filter((_, idx) => result.data?.[idx]?.details?.error === 'DeviceNotRegistered')
          .map((m) => m.to);
        if (deadTokens.length > 0) {
          await supabase.from('push_tokens').delete().in('token', deadTokens);
        }
      }
      sent++;
    }

    return new Response(JSON.stringify({ circles: circles?.length ?? 0, sent, skipped }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
```

- [ ] **Step 6: Deploy and invoke it once by hand**

Supabase Dashboard → Edge Functions → New function `daily-digest` → paste both files → Deploy → turn OFF "Enforce JWT verification".

Then invoke it once from the Dashboard's "Invoke" panel (empty `{}` body) and read the JSON response.
Expected: `{"circles": N, "sent": X, "skipped": Y}` with `sent + skipped ≤ N`. If your test circle had activity in the last 24h, you receive one push whose body is up to three bulleted lines.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/daily-digest/
git commit -m "Add daily-digest edge function with a tested digest composer"
```

---

### Task 9: Schedule the digest and document the whole change

**Files:**
- Create: `supabase/migrations/0040_daily_digest_cron.sql`
- Modify: `ARCHITECTURE.md`

**Interfaces:**
- Consumes: the deployed `daily-digest` function (Task 8)
- Produces: nothing

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0040_daily_digest_cron.sql`:

```sql
-- Schedules the daily-digest Edge Function (docs/superpowers/specs/
-- 2026-07-31-notifications-design.md). If this errors with "permission
-- denied" or "extension not available", enable pg_cron and pg_net first via
-- Dashboard -> Database -> Extensions, then re-run just the
-- `select cron.schedule(...)` statement below.
--
-- 13:30 UTC = 19:00 IST, an early-evening summary. Fixed UTC for everyone
-- rather than per-user local time, matching the approximation migration
-- 0016 already documents for check-streaks-at-risk.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-digest',
  '30 13 * * *',
  $$
  select net.http_post(
    url := 'https://xkruqvuppiguaqyjiusu.supabase.co/functions/v1/daily-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Apply and verify it**

Paste into Supabase Dashboard → SQL Editor → Run, then:

```sql
select jobname, schedule, active from cron.job where jobname = 'daily-digest';
```

Expected: one row — `daily-digest | 30 13 * * * | t`.

- [ ] **Step 3: Run the full verification suite**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# fail 0` across 33 tests (6 moments + 11 tiers + 7 gardenGrowth + 9 digest), then no output from either of the other two.

- [ ] **Step 4: Verify the volume reduction on a device**

Over one ordinary day in a real circle, confirm in order:

1. A friend completing a goal produces a **Moments row and no push**.
2. A friend's `great` or `okay` check-in produces **no push**; a `tough` one **does**.
3. Posting an ask still pushes to everyone else.
4. A nudge still pushes to exactly the nudged person.
5. Your own streak-at-risk reminder reaches **you** (and your buddy), not the whole circle.
6. Checking in on your buddy pushes **once**, to them.
7. At 19:00 IST, one digest arrives with up to three bulleted lines; a circle with no qualifying activity gets nothing.
8. Turning **Personal alerts** off in Circle Settings stops 2–4; turning **Daily digest** off stops 7; join requests and approvals keep arriving with both off.

- [ ] **Step 5: Document it**

Add to `ARCHITECTURE.md`, directly after the "Moments feed and unread state" bullet:

```markdown
- **Notification tiering and the daily digest** (docs/superpowers/specs/2026-07-31-notifications-design.md): pushing is now a deliberate promotion out of the feed rather than the default — `tierFor` ([supabase/functions/notify-circle/tiers.ts](supabase/functions/notify-circle/tiers.ts), unit-tested via `npm test`) returns `feed` for anything it has not been told to push, including unknown event types, so the failure mode of forgetting a new type is a missing push rather than a surprise one. Only asks, streak-at-risk reminders, tough-day check-ins, nudges, ask replies and membership rows still push; every celebration is feed-only. `notify-circle` builds a list of *deliveries* (recipient group + title + body) instead of one shared title/body, because a streak-at-risk reminder reads differently to the goal owner than to their buddy. Two recipient bugs died here: `reminder` events notified everyone *except* the goal owner (the row's `user_id` is the subject, not an actor), now narrowed to the owner plus their buddy; and buddy check-ins inserted a `reminder` row that pushed *"[Buddy] could use a nudge"* to the whole circle including the sender, now a feed-only `buddy_checkin` type with the paired `nudges` row carrying the single push. `buddy_checkin` is deliberately feed-only despite the spec listing it as immediate — the `nudges` row already pushes to exactly that person with better copy, and both would double-notify. `daily-digest` ([supabase/functions/daily-digest/index.ts](supabase/functions/daily-digest/index.ts), pg_cron at 13:30 UTC per migration `0040`) composes one summary per circle from the last 24h of `events` — no new table, since every event is already there for the feed — capped at three lines plus an "and N more" tail, and sends nothing at all on a quiet day. Migration `0039` adds `goal_started`, `achievement_unlocked`, `garden_grew` and `buddy_checkin`; `achievement_unlocked` has no emitter by design, because every `useCreateAchievement` call site already emits `goal_completed`/`streak`/`challenge_completed` for the same moment. `garden_grew` is detected at log time by `growthStageCrossed` ([src/lib/gardenGrowth.ts](src/lib/gardenGrowth.ts)) comparing the member's *maximum* streak across their goals before and after — garden stage is derived live and never persisted, so there is nothing to diff against otherwise; growth only, never wilting, per `MoodCheckinCard`'s no-shame rule.
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0040_daily_digest_cron.sql ARCHITECTURE.md
git commit -m "Schedule daily-digest and document notification tiering"
```

---

## What this plan deliberately does not do

- **The "I need support" button.** Its tier slot (`support_requested`, immediate, to the circle) is reserved by the spec but no UI, placement or anti-abuse thinking exists yet.
- **A weekly summary feed event.** `weekly-recap` is an on-demand AI call triggered by opening the Circle tab, not a scheduled job, so nothing produces a weekly artifact to insert — and `WeeklyRecapCard` already gives the recap a home.
- **Quiet hours.** At 1–3 pushes a day, all personal and wanted, a quiet window adds scheduling complexity and a "why wasn't I told?" support burden for a problem the tiering already solves.
- **Per-user timezones.** Both crons fire at fixed UTC, as migration `0016` already documents.
- **Profile-update events.** A changed avatar is not a moment.
