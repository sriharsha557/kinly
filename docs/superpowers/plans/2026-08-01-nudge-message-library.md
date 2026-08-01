# Nudge Message Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-call Claude API nudge-message generator with a seeded `nudge_messages` table, fetched once per session and picked locally — removing the cost, the latency, the daily cap and the ability to fabricate context.

**Architecture:** A pure, unit-tested `pickNudgeMessage` does filtering, recent-repeat avoidance, weighted selection and placeholder substitution. A migration creates the table and seeds ~70 messages. A React Query hook fetches the whole table once per session. The edge function and its client wrapper are deleted.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Supabase (Postgres + RLS), React Query, `node:test` with `--experimental-strip-types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-nudge-message-library-design.md` governs all behaviour here.
- **Governing principle:** *A curated library, picked well.* Variety comes from how many good lines exist and how they are chosen, not from generating one each time.
- **No API call anywhere in the nudge path** when this is done. No `ANTHROPIC_API_KEY` dependency, no per-nudge cost, no daily cap.
- **No message may render an unsubstituted or empty placeholder.** A message is eligible only when the context satisfies *every* placeholder it names — that is the structural guarantee replacing "hope the model behaves".
- **The same message never appears twice running within a session**, unless excluding recents would leave nothing.
- **Migrations are sequential.** The next number is `0044`.
- **Migrations are applied by hand** in the Supabase SQL Editor; this repo has no CLI step.
- **No raw hex in components.** All colour from `useTheme()` tokens (`design/PRINCIPLES.md`).
- **Verification commands:** `npm test`, `npx tsc --noEmit`, `npx eslint <paths>`. All three clean before a task is committed.
- **Test count starts at 62.**
- **Test imports use the explicit `.ts` extension** (`from './nudgeMessages.ts'`) — Node ESM performs no extension resolution.
- **Every commit message body ends with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

### Task 1: `pickNudgeMessage` — the selection rules

**Files:**
- Create: `src/lib/nudgeMessages.ts`
- Create: `src/lib/nudgeMessages.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface NudgeMessage { id: string; kind: string; placeholders: readonly string[]; body: string; weight: number }`, `interface NudgeContext { name?: string; goal?: string; streak?: number }`, and `pickNudgeMessage(messages, kind, context, recentIds, random): { id: string; body: string } | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nudgeMessages.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNudgeMessage, type NudgeMessage } from './nudgeMessages.ts';

function msg(
  id: string,
  kind: string,
  body: string,
  placeholders: string[] = [],
  weight = 1,
): NudgeMessage {
  return { id, kind, body, placeholders, weight };
}

test('picks a message of the requested kind', () => {
  const messages = [msg('a', 'cheer', 'Nice work!'), msg('b', 'water', 'Drink up!')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, [], 0), { id: 'a', body: 'Nice work!' });
});

test('returns null when no message of that kind exists', () => {
  assert.equal(pickNudgeMessage([msg('a', 'cheer', 'Nice work!')], 'walk', {}, [], 0), null);
});

test('substitutes every placeholder it uses', () => {
  const messages = [msg('a', 'cheer', 'Proud of you, {name}!', ['name'])];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', { name: 'Priya' }, [], 0), {
    id: 'a',
    body: 'Proud of you, Priya!',
  });
});

test('substitutes several placeholders in one message', () => {
  const messages = [msg('a', 'keep_going', '{name}, keep going on {goal}!', ['name', 'goal'])];
  assert.deepEqual(
    pickNudgeMessage(messages, 'keep_going', { name: 'Sara', goal: 'Run 5km' }, [], 0),
    { id: 'a', body: 'Sara, keep going on Run 5km!' },
  );
});

test('a message is ineligible when its placeholder has no value', () => {
  // The structural guarantee: "Keep going on undefined!" can never render.
  const messages = [
    msg('needs-goal', 'keep_going', 'Keep going on {goal}!', ['goal']),
    msg('generic', 'keep_going', "You've got this."),
  ];
  assert.deepEqual(pickNudgeMessage(messages, 'keep_going', {}, [], 0), {
    id: 'generic',
    body: "You've got this.",
  });
});

test('an empty string does not satisfy a placeholder', () => {
  const messages = [
    msg('needs-name', 'cheer', 'Go on, {name}!', ['name']),
    msg('generic', 'cheer', 'Go on!'),
  ];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', { name: '' }, [], 0), {
    id: 'generic',
    body: 'Go on!',
  });
});

test('a streak of zero still satisfies the streak placeholder', () => {
  // 0 is falsy but is a real value - a naive truthiness check would drop it.
  const messages = [msg('a', 'streak', '{streak} days!', ['streak'])];
  assert.deepEqual(pickNudgeMessage(messages, 'streak', { streak: 0 }, [], 0), {
    id: 'a',
    body: '0 days!',
  });
});

test('skips messages shown recently', () => {
  const messages = [msg('a', 'cheer', 'First'), msg('b', 'cheer', 'Second')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, ['a'], 0), { id: 'b', body: 'Second' });
});

test('ignores the recent list rather than returning nothing', () => {
  // A repeat beats no message at all.
  const messages = [msg('a', 'cheer', 'Only one')];
  assert.deepEqual(pickNudgeMessage(messages, 'cheer', {}, ['a'], 0), { id: 'a', body: 'Only one' });
});

test('weight biases selection proportionally', () => {
  // Total weight 4: 'heavy' owns [0, 0.75), 'light' owns [0.75, 1).
  const messages = [msg('heavy', 'cheer', 'Heavy', [], 3), msg('light', 'cheer', 'Light', [], 1)];
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0)?.id, 'heavy');
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.7)?.id, 'heavy');
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.8)?.id, 'light');
});

test('random at the very top of the range still returns a message', () => {
  // Guards the off-by-one where random === 1 falls past the last bucket.
  const messages = [msg('a', 'cheer', 'A', [], 1), msg('b', 'cheer', 'B', [], 1)];
  assert.equal(pickNudgeMessage(messages, 'cheer', {}, [], 0.999999)?.id, 'b');
  assert.notEqual(pickNudgeMessage(messages, 'cheer', {}, [], 1), null);
});

test('an empty library returns null', () => {
  assert.equal(pickNudgeMessage([], 'cheer', {}, [], 0), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './nudgeMessages.ts'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/nudgeMessages.ts`:

```ts
// Chooses the copy for a nudge from a curated library (docs/superpowers/
// specs/2026-08-01-nudge-message-library-design.md), replacing a per-call
// Claude API request.
//
// The eligibility rule is the important part. Each message declares the
// placeholders it needs, and is only ever considered when the caller can
// supply every one of them. That makes "Keep going on undefined!"
// structurally impossible rather than something we hope the copy avoids -
// which matters, because the API version this replaces did once congratulate
// a real user on a presentation they had never given.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface NudgeMessage {
  id: string;
  kind: string;
  placeholders: readonly string[];
  body: string;
  weight: number;
}

export interface NudgeContext {
  name?: string;
  goal?: string;
  streak?: number;
}

// Deliberately not a truthiness check: a streak of 0 is a real value that a
// message may legitimately render, while an empty name is not.
function satisfies(context: NudgeContext, placeholder: string): boolean {
  const value = context[placeholder as keyof NudgeContext];
  if (value === undefined || value === null) return false;
  return typeof value === 'number' ? true : value.length > 0;
}

function substitute(body: string, context: NudgeContext): string {
  return body
    .replace(/\{name\}/g, String(context.name ?? ''))
    .replace(/\{goal\}/g, String(context.goal ?? ''))
    .replace(/\{streak\}/g, String(context.streak ?? ''));
}

export function pickNudgeMessage(
  messages: readonly NudgeMessage[],
  kind: string,
  context: NudgeContext,
  recentIds: readonly string[],
  // 0..1, injected rather than read from Math.random() so tests pin the
  // choice instead of asserting on a distribution.
  random: number,
): { id: string; body: string } | null {
  const eligible = messages.filter(
    (message) =>
      message.kind === kind &&
      message.placeholders.every((placeholder) => satisfies(context, placeholder)),
  );
  if (eligible.length === 0) return null;

  // Immediate repetition is what people notice; overall variety is invisible
  // beside it. But a repeat beats no message, so an exhausted pool falls
  // back to the full eligible set rather than returning nothing.
  const recent = new Set(recentIds);
  const fresh = eligible.filter((message) => !recent.has(message.id));
  const pool = fresh.length > 0 ? fresh : eligible;

  const totalWeight = pool.reduce((sum, message) => sum + message.weight, 0);
  // Math.min guards random === 1, which would otherwise fall past the last
  // bucket and leave `chosen` undefined.
  let cursor = Math.min(random, 0.999999999) * totalWeight;
  let chosen = pool[pool.length - 1];
  for (const message of pool) {
    cursor -= message.weight;
    if (cursor < 0) {
      chosen = message;
      break;
    }
  }

  return { id: chosen.id, body: substitute(chosen.body, context) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 12 new tests, 74 total, `# fail 0`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/nudgeMessages.ts src/lib/nudgeMessages.test.ts`
Expected: no output from either

- [ ] **Step 6: Commit**

```bash
git add src/lib/nudgeMessages.ts src/lib/nudgeMessages.test.ts
git commit -m "Add pickNudgeMessage, where a placeholder can never render empty"
```

---

### Task 2: Migration — the table, the `support` kind, and the library

**Files:**
- Create: `supabase/migrations/0044_nudge_messages.sql`

**Interfaces:**
- Produces: table `nudge_messages`, enum value `nudge_kind.support`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0044_nudge_messages.sql`:

```sql
-- Curated nudge copy, replacing the per-call Claude API generator
-- (docs/superpowers/specs/2026-08-01-nudge-message-library-design.md).
--
-- The API version cost money per cheer, added a third-party round trip before
-- the nudge row was even written, silently degraded to one canned string per
-- kind past a 30/day cap, and - asked for a "specific" message while given no
-- facts - once congratulated a real user on a presentation they never gave.
-- Nudges do not need originality. They need to be warm, instant and true.
--
-- Postgres cannot add an enum value and use it in the same transaction, so
-- the alter below must run as its own statement. The SQL Editor does that
-- automatically; do not wrap this file in an explicit begin/commit.

-- A tough-day check-in used to send 'keep_going' - the same kind as "keep
-- going on your goal". Someone who has just said today was hard should not
-- be told to push harder, so support gets its own pool.
alter type nudge_kind add value if not exists 'support';

create table if not exists nudge_messages (
  id           uuid primary key default gen_random_uuid(),
  kind         nudge_kind not null,
  -- The substitutions this message REQUIRES. It is only ever eligible when
  -- the caller can supply every one of them. An array rather than a single
  -- column so a future {circle} needs no migration.
  placeholders text[] not null default '{}',
  body         text not null,
  -- Biases selection: safe-anywhere lines earn more, situational ones earn 1.
  weight       integer not null default 1 check (weight > 0),
  -- Retire copy without deleting it: a line that lands badly is switched off
  -- with one update and stays in history.
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table nudge_messages enable row level security;

-- Reference data: any signed-in user reads it, nobody writes it from the
-- app. Edits happen here, in SQL.
create policy "authenticated users read nudge messages" on nudge_messages
  for select to authenticated using (true);
```

- [ ] **Step 2: Verify the enum and table exist**

Paste into Supabase Dashboard → SQL Editor → Run, then:

```sql
select enumlabel from pg_enum where enumtypid = 'nudge_kind'::regtype order by enumsortorder;
select count(*) from nudge_messages;
```

Expected: seven labels ending in `support`, and a count of `0` — the seed is the next task.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0044_nudge_messages.sql
git commit -m "Add nudge_messages table and the support nudge kind"
```

---

### Task 3: Seed the library

Split from Task 2 because Postgres will not accept `'support'` in the same transaction that adds it to the enum — the seed must run after the type change has committed. It is also the file most likely to be edited by hand later, and keeping it separate keeps that diff readable.

**Files:**
- Create: `supabase/migrations/0045_nudge_messages_seed.sql`

**Interfaces:**
- Consumes: table `nudge_messages` and enum value `support` (Task 2)

- [ ] **Step 1: Write the seed**

Create `supabase/migrations/0045_nudge_messages_seed.sql`:

```sql
-- The library itself. Separate from 0044 because 'support' cannot be used in
-- the same transaction that adds it to the nudge_kind enum.
--
-- Weighting: 3 = safe in almost any situation, 2 = usually fine, 1 = good but
-- situational. Volume is deliberately ~70 rather than the 150 first proposed:
-- writing that much before the voice is proven is the expensive mistake, and
-- adding more later is one insert.
--
-- Voice notes. support: no exclamation-heavy cheerfulness at someone having a
-- bad day, no advice, and no "you've got this" - that reads as pressure here
-- and belongs in keep_going. About a third of lines carry {name}, so the pool
-- mixes addressed and unaddressed.
--
-- Safe to re-run: deletes the seeded set first. Hand-added rows are NOT
-- protected by this - if you add your own copy, add it in a later migration.
delete from nudge_messages;

insert into nudge_messages (kind, body, placeholders, weight) values
  -- support (15): a tough-day check-in.
  ('support', 'Thinking of you today.', '{}', 3),
  ('support', 'No pressure today. I''m here.', '{}', 3),
  ('support', 'Rough days happen. Glad you said something.', '{}', 2),
  ('support', 'Hey {name} — here if you want to talk.', '{name}', 3),
  ('support', 'You don''t have to do anything today.', '{}', 2),
  ('support', 'Sending you something good, {name}.', '{name}', 2),
  ('support', 'Tomorrow gets to be different.', '{}', 2),
  ('support', 'That sounds hard. I''m around.', '{}', 2),
  ('support', 'Be kind to yourself today.', '{}', 3),
  ('support', 'You showed up and said it. That counts.', '{}', 1),
  ('support', 'Take the day off if you need it, {name}.', '{name}', 1),
  ('support', 'Still in your corner.', '{}', 3),
  ('support', 'Nothing to fix. Just checking in.', '{}', 2),
  ('support', 'Hope tonight''s a bit lighter.', '{}', 1),
  ('support', 'Whatever today was, it''s allowed.', '{}', 1),

  -- cheer (15): celebrating something they did.
  ('cheer', 'Proud of you!', '{}', 3),
  ('cheer', 'Nice one, {name}!', '{name}', 3),
  ('cheer', 'That''s the good stuff.', '{}', 2),
  ('cheer', 'Look at you go.', '{}', 3),
  ('cheer', 'Well done, {name}.', '{name}', 3),
  ('cheer', 'You made that look easy.', '{}', 2),
  ('cheer', 'Big fan of this.', '{}', 2),
  ('cheer', 'Quietly impressed over here.', '{}', 1),
  ('cheer', 'That''s a proper effort.', '{}', 2),
  ('cheer', 'Yes! Keep it rolling.', '{}', 2),
  ('cheer', '{streak} days strong — nice going.', '{streak}', 2),
  ('cheer', '{name}, that''s {streak} days now. Solid.', '{name,streak}', 2),
  ('cheer', 'Good on you for {goal}.', '{goal}', 2),
  ('cheer', 'Noticed you sticking with this.', '{}', 1),
  ('cheer', 'This is becoming a habit, and I''m here for it.', '{}', 1),

  -- keep_going (15): encouragement toward a goal.
  ('keep_going', 'You''ve got this.', '{}', 3),
  ('keep_going', 'Still cheering for you, {name}.', '{name}', 3),
  ('keep_going', 'One small step today still counts.', '{}', 1),
  ('keep_going', 'No rush. Just don''t stop.', '{}', 2),
  ('keep_going', 'Keep going on {goal}!', '{goal}', 3),
  ('keep_going', '{name}, today''s a good day for {goal}.', '{name,goal}', 2),
  ('keep_going', 'Even a little counts today.', '{}', 2),
  ('keep_going', 'You''re closer than you think.', '{}', 2),
  ('keep_going', 'Back at it when you''re ready.', '{}', 2),
  ('keep_going', 'Rooting for you, {name}.', '{name}', 3),
  ('keep_going', 'Momentum beats perfect.', '{}', 1),
  ('keep_going', 'Pick it back up whenever.', '{}', 1),
  ('keep_going', 'Nothing wasted — start again today.', '{}', 1),
  ('keep_going', 'Your future self says thanks.', '{}', 1),
  ('keep_going', 'Small and steady wins this.', '{}', 2),

  -- water (6)
  ('water', 'Go drink some water!', '{}', 3),
  ('water', 'Hydrate, {name}.', '{name}', 3),
  ('water', 'Water break?', '{}', 2),
  ('water', 'Your water bottle misses you.', '{}', 1),
  ('water', 'Quick glass of water — go on.', '{}', 2),
  ('water', 'Sip something, {name}.', '{name}', 1),

  -- walk (6)
  ('walk', 'Go stretch your legs!', '{}', 3),
  ('walk', 'Time for a walk, {name}?', '{name}', 3),
  ('walk', 'Five minutes outside would help.', '{}', 2),
  ('walk', 'Shoes on. Just around the block.', '{}', 2),
  ('walk', 'Fresh air is calling.', '{}', 1),
  ('walk', 'Quick wander, {name}?', '{name}', 1),

  -- workout (6)
  ('workout', 'Let''s get that workout in!', '{}', 3),
  ('workout', 'Gym time, {name}.', '{name}', 3),
  ('workout', 'Twenty minutes is still a workout.', '{}', 2),
  ('workout', 'Move a bit today?', '{}', 2),
  ('workout', 'Future you will be glad.', '{}', 1),
  ('workout', 'Go on {name}, get it done.', '{name}', 1),

  -- streak (6)
  ('streak', 'Don''t break the streak now!', '{}', 3),
  ('streak', '{streak} days. Keep it alive!', '{streak}', 3),
  ('streak', '{name}, that streak is worth saving.', '{name}', 3),
  ('streak', 'One log keeps it going.', '{}', 2),
  ('streak', 'Too good a run to drop, {name}.', '{name}', 2),
  ('streak', '{streak} days of work — protect it.', '{streak}', 1);
```

- [ ] **Step 2: Apply and verify the seed**

Paste into the SQL Editor → Run, then:

```sql
select kind, count(*) from nudge_messages group by kind order by kind;

-- Every placeholder a message names must be one the client can supply.
select body, placeholders from nudge_messages
where exists (
  select 1 from unnest(placeholders) p where p not in ('name', 'goal', 'streak')
);

-- Every {placeholder} appearing in a body must be declared.
select body, placeholders from nudge_messages
where (body like '%{name}%'   and not ('name'   = any(placeholders)))
   or (body like '%{goal}%'   and not ('goal'   = any(placeholders)))
   or (body like '%{streak}%' and not ('streak' = any(placeholders)));
```

Expected: counts of `cheer 15`, `keep_going 15`, `support 15`, `streak 6`, `walk 6`, `water 6`, `workout 6` — and **zero rows** from both of the other two queries. Those two are the guard against a typo producing an unsubstitutable message.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0045_nudge_messages_seed.sql
git commit -m "Seed the nudge message library"
```

---

### Task 4: `useNudgeMessages` — fetch the library once

**Files:**
- Create: `src/hooks/useNudgeMessages.ts`

**Interfaces:**
- Consumes: `NudgeMessage` from `src/lib/nudgeMessages` (Task 1)
- Produces: `useNudgeMessages()` returning `{ messages: NudgeMessage[] }`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useNudgeMessages.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { NudgeMessage } from '../lib/nudgeMessages';

// The whole library, fetched once per session. Seeded copy does not change
// mid-session, so a long staleTime makes every nudge after the first fetch
// instant and local - which is the point of replacing a per-call API request.
//
// Offline is not a concern: sending a nudge writes rows to Postgres, so the
// network is already required by the time this matters.
const LIBRARY_STALE_TIME = 60 * 60 * 1000;

export function useNudgeMessages() {
  const query = useQuery({
    queryKey: ['nudgeMessages'],
    staleTime: LIBRARY_STALE_TIME,
    queryFn: async (): Promise<NudgeMessage[]> => {
      const { data, error } = await supabase
        .from('nudge_messages')
        .select('id, kind, placeholders, body, weight')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        kind: row.kind as string,
        placeholders: (row.placeholders as string[]) ?? [],
        body: row.body as string,
        weight: (row.weight as number) ?? 1,
      }));
    },
  });

  return { messages: query.data ?? [] };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useNudgeMessages.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNudgeMessages.ts
git commit -m "Fetch the nudge message library once per session"
```

---

### Task 5: `useNudgeCopy` — the shared picker with recent-repeat memory

Both call sites need the same thing: a library, a session-scoped memory of what was just sent, and a picker. Putting it in one hook keeps that memory shared, so a cheer from the Circle tab and one from the Today feed do not each independently repeat the same line.

**Files:**
- Create: `src/hooks/useNudgeCopy.ts`

**Interfaces:**
- Consumes: `useNudgeMessages` (Task 4), `pickNudgeMessage` / `NudgeContext` from `src/lib/nudgeMessages` (Task 1)
- Produces: `useNudgeCopy()` returning `{ nudgeCopy: (kind: string, context: NudgeContext) => string }`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useNudgeCopy.ts`:

```ts
import { useCallback } from 'react';
import { useNudgeMessages } from './useNudgeMessages';
import { pickNudgeMessage, type NudgeContext } from '../lib/nudgeMessages';

// Module-level rather than component state, deliberately: both call sites
// send nudges, and a shared memory means a cheer from the Circle tab and one
// from the Today feed cannot each independently repeat the same line. Reset
// on app restart, which is fine - a repeat across launches is not the one
// anybody notices.
const RECENT_LIMIT = 5;
let recentIds: string[] = [];

// Last-resort copy for the moment before the library has loaded, or if the
// query failed. One line, not a per-kind table: the old FALLBACK_MESSAGES
// map existed to paper over a rate-limited API, and there is no rate limit
// now - this only covers a cold cache on a slow connection.
const UNLOADED_FALLBACK = 'Thinking of you!';

export function useNudgeCopy() {
  const { messages } = useNudgeMessages();

  const nudgeCopy = useCallback(
    (kind: string, context: NudgeContext): string => {
      const picked = pickNudgeMessage(messages, kind, context, recentIds, Math.random());
      if (!picked) return UNLOADED_FALLBACK;
      recentIds = [picked.id, ...recentIds].slice(0, RECENT_LIMIT);
      return picked.body;
    },
    [messages],
  );

  return { nudgeCopy };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/hooks/useNudgeCopy.ts`
Expected: no output from either

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNudgeCopy.ts
git commit -m "Add useNudgeCopy, sharing recent-message memory across both senders"
```

---

### Task 6: Move both call sites onto the library

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/hooks/useNudgeMember.ts`
- Modify: `src/components/CircleTodaySection.tsx`
- Modify: `src/components/CircleMembersSection.tsx`
- Modify: `src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: `useNudgeCopy` (Task 5)
- Produces: `NudgeKind` gains `'support'`

- [ ] **Step 1: Add `support` to the TypeScript union**

Migration `0044` added it to the Postgres enum; the client type has to match or Step 2's `kind: 'support'` will not compile.

In `src/types/models.ts`, replace:

```ts
export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'keep_going' | 'streak';
```

with:

```ts
// 'support' is for a tough-day check-in, added alongside migration 0044. It
// exists so someone who has just said today was hard is not sent the same
// copy as someone being told to keep going on a goal.
export type NudgeKind = 'cheer' | 'water' | 'walk' | 'workout' | 'keep_going' | 'streak' | 'support';
```

Note `NUDGE_KINDS` in `src/screens/TodayScreen.tsx` is an array literal, not a `Record<NudgeKind, …>`, so widening the union does not force a new entry there — and it should not get one. `support` is sent by the Circle tab in response to a tough-day check-in, never chosen from the Today feed's nudge picker.

- [ ] **Step 2: Rework `useNudgeMember`'s message source**

In `src/hooks/useNudgeMember.ts`, replace the `generateNudgeMessage` import with:

```ts
import { useNudgeCopy } from './useNudgeCopy';
import type { NudgeContext } from '../lib/nudgeMessages';
```

Inside `useNudgeMember`, before the `useMutation` call, add:

```ts
  const { nudgeCopy } = useNudgeCopy();
```

Change the mutation's argument type: replace `context?: string;` with:

```ts
      // Structured, not prose. The old string existed only to feed a prompt;
      // the library needs values it can substitute.
      context?: NudgeContext;
```

and replace the message line:

```ts
      const message = await generateNudgeMessage(kind, targetName, context);
```

with:

```ts
      const message = nudgeCopy(kind, { name: targetName, ...context });
```

- [ ] **Step 3: Update `CircleTodaySection`**

In `src/components/CircleTodaySection.tsx`, replace the `nudgeMember.mutateAsync` call's `kind` and `context` properties:

```tsx
        kind: row.reason === 'tough_day' ? 'keep_going' : 'cheer',
        // Context only where it is both true and safe to say back. A tough
        // day is worth naming. "Quiet for 4 days" is deliberately withheld:
        // it is true, but handing it to the generator invites a message that
        // reads as being called out, and MoodCheckinCard's no-shame rule
        // applies to what we write on someone's behalf too.
        context: row.reason === 'tough_day' ? 'they said today was a tough one' : undefined,
```

becomes:

```tsx
        // A tough day gets the support pool, which is written for exactly
        // that: no advice, no "you've got this", nothing that reads as
        // pressure. A quiet stretch gets an ordinary cheer - deliberately
        // NOT copy about being quiet, since MoodCheckinCard's no-shame rule
        // applies to what we write on someone's behalf too.
        kind: row.reason === 'tough_day' ? 'support' : 'cheer',
```

Delete the `context` property entirely from this call.

- [ ] **Step 4: Update `CircleMembersSection`**

In `src/components/CircleMembersSection.tsx`, replace:

```tsx
        kind: 'cheer',
        // Their streak is the one thing we actually know, so it is the one
        // thing the message may mention. With no streak we pass nothing and
        // the generator is instructed to invent nothing.
        context: streak > 0 ? `they are on a ${streak}-day streak` : undefined,
```

with:

```tsx
        kind: 'cheer',
        // Their streak is the one thing we actually know, so it is the one
        // thing a message may mention. With no streak, streak-placeholder
        // messages are simply ineligible and a generic line is picked.
        context: streak > 0 ? { streak } : undefined,
```

- [ ] **Step 5: Update `TodayScreen`**

In `src/screens/TodayScreen.tsx`, replace the import:

```tsx
import { generateNudgeMessage } from '../lib/nudgeMessage';
```

with:

```tsx
import { useNudgeCopy } from '../hooks/useNudgeCopy';
```

In the component that defines `handleNudge`, add alongside the other hooks:

```tsx
  const { nudgeCopy } = useNudgeCopy();
```

Then replace:

```tsx
      const recipientName = event.profiles?.name ?? 'your friend';
      const message = await generateNudgeMessage(kind, recipientName, goalTitleFromEvent(event));
```

with:

```tsx
      const recipientName = event.profiles?.name ?? 'your friend';
      const message = nudgeCopy(kind, { name: recipientName, goal: goalTitleFromEvent(event) });
```

Note `handleNudge` stays `async` — `sendNudge.mutateAsync` below it is still awaited.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/`
Expected: 74 passing, then no output from either

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useNudgeMember.ts src/components/CircleTodaySection.tsx src/components/CircleMembersSection.tsx src/screens/TodayScreen.tsx
git commit -m "Draw nudge copy from the library instead of the API"
```

---

### Task 7: Delete the generator

**Files:**
- Delete: `src/lib/nudgeMessage.ts`
- Delete: `supabase/functions/generate-nudge-message/index.ts`

- [ ] **Step 1: Confirm nothing still imports it**

Run: `grep -rn "generateNudgeMessage\|lib/nudgeMessage'" src/`
Expected: no output. Any hit means Task 6 is incomplete — stop and finish it rather than deleting a file still in use.

- [ ] **Step 2: Delete both files**

```bash
git rm src/lib/nudgeMessage.ts
git rm -r supabase/functions/generate-nudge-message
```

- [ ] **Step 3: Typecheck, lint, test**

Run: `npm test && npx tsc --noEmit && npx eslint src/`
Expected: 74 passing, then no output from either

- [ ] **Step 4: Commit**

```bash
git commit -m "Delete the nudge message API generator"
```

---

### Task 8: Verify and document

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Run everything**

```bash
npm test && npx tsc --noEmit && npx eslint src/
```

Expected: `# pass 74`, `# fail 0`, then no output from either.

- [ ] **Step 2: Confirm no API remains in the nudge path**

Run: `grep -rn "anthropic\|ANTHROPIC" src/ supabase/functions/ | grep -iv "circle-ai-insight\|weekly-recap"`
Expected: no output. `circle-ai-insight` and `weekly-recap` keep using the API deliberately — they summarise real circle data, which a fixed library cannot.

- [ ] **Step 3: Verify on a device**

Publish to preview and check:

```bash
npx eas-cli update --channel preview --message "Nudge message library" --non-interactive
```

Confirm, in order:
1. Cheer someone from the Circle tab's member rows. A message arrives, and it is one of the seeded `cheer` lines.
2. Cheer the same person four more times. No line repeats back-to-back.
3. Cheer someone with a streak — some messages mention the day count; none render `{streak}` literally or an empty gap.
4. Cheer someone with no streak — no message mentions a streak.
5. From Today's feed, nudge on a goal event with each of the six kinds. Every one produces a message.
6. Have someone log a tough day, then use **Check in** on their Circle Today row. The message is gentle — from the `support` pool, not "you've got this".

- [ ] **Step 4: Delete the deployed edge function**

Supabase Dashboard → Edge Functions → **`smooth-responder`** (its display name reads `generate-nudge-message`; the slug was fixed at creation and never followed the rename) → Delete. Nothing calls it after Task 7.

- [ ] **Step 5: Document it**

Add to `ARCHITECTURE.md`, after the "Health Connect step sync" bullet:

```markdown
- **Nudge message library** (docs/superpowers/specs/2026-08-01-nudge-message-library-design.md): nudge and cheer copy comes from the seeded `nudge_messages` table (migrations `0044`/`0045`), not from an API. The previous version called Claude per nudge — money per cheer, a third-party round trip before the row was written, a 30/day cap that degraded silently to one canned string per kind, and, asked for a "specific" message while given no facts, it once congratulated a real user on a presentation they had never given. Each row declares the `placeholders` it requires (`{name}` / `{goal}` / `{streak}`) and is eligible only when the caller supplies every one, which makes "Keep going on undefined!" structurally impossible rather than something the copy has to avoid. `weight` biases selection toward safe-anywhere lines; `is_active` retires copy without deleting it. `pickNudgeMessage` ([src/lib/nudgeMessages.ts](src/lib/nudgeMessages.ts)) is pure and unit-tested with an injected `random`, and takes the ids of the last 5 messages sent so the same line never appears twice running — immediate repetition is what people notice, overall variety is invisible beside it. That memory is module-level in `useNudgeCopy` so both senders share it. The library is fetched once per session (`useNudgeMessages`, one-hour `staleTime`), so every nudge after the first is instant and local. `nudge_kind` gained `support` for tough-day check-ins, which previously shared `keep_going`'s copy and so could tell someone having a hard day to push harder. `circle-ai-insight` and `weekly-recap` still use the API deliberately — they summarise real circle data, which a fixed library cannot.
```

- [ ] **Step 6: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "Document the nudge message library"
```

---

## What this plan deliberately does not do

- **Tags** (`gentle` / `playful` / `serious`). The `placeholders` array proves the schema takes new dimensions without pain; add `tags text[]` when there is a reason to filter on one.
- **Time and state conditions** (`morning`, `weekend`, `long_streak`, `first_week`). Appealing, still deterministic and local — but it needs a condition vocabulary and an evaluator, and the library should prove itself first.
- **Per-user history.** `recentIds` is per session and in memory. Tracking what each person has been sent across launches means a table and a write per nudge, for a problem nobody has reported.
- **Touching `circle-ai-insight` or `weekly-recap`.** Both summarise real data and stay on the API.
