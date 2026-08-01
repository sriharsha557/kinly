# Nudge message library — curated copy instead of a per-call API

**Date:** 2026-08-01
**Status:** Approved design, ready for implementation planning

## Problem

Every nudge and cheer in Kinly calls the Claude API to write its message. That buys slight wording variety, and costs:

- **Money per nudge.** A paid API call every time someone taps Cheer.
- **Latency before the nudge exists.** The message is generated *before* the `events` and `nudges` rows are written, so the sender waits on a network round trip to a third party.
- **A daily cap that degrades silently.** `DAILY_CAP = 30` in the edge function; past it, `generateNudgeMessage` falls back to one of six hardcoded strings and nobody is told.
- **An `ANTHROPIC_API_KEY` to keep alive**, for text that does not need originality.
- **Fabricated context.** The prompt asked for a "specific" message while passing no facts, so the model invented them. A real user was congratulated on crushing a presentation they had never given. The prompt has since been fixed to forbid invention, but the class of failure is inherent: a generative model asked for warmth will reach for specifics it does not have.

Nudges do not need originality. They need to be warm, instant, and true.

## Governing principle

> **A curated library, picked well.** Variety comes from how many good lines exist and how they are chosen, not from generating a new one each time.

## Schema

```sql
create table nudge_messages (
  id           uuid primary key default gen_random_uuid(),
  kind         nudge_kind not null,
  placeholders text[] not null default '{}',
  body         text not null,
  weight       integer not null default 1 check (weight > 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
```

**`placeholders`** lists the substitutions a message *requires*. `"Keep going on {goal}!"` is `{goal}`; `"Proud of you, {name}!"` is `{name}`; a message using both is `{name,goal}`. A message is eligible only when the calling context can satisfy **every** placeholder it names — which is what structurally prevents "Keep going on undefined!". An array rather than a single column so a future `{circle}` needs no migration.

**`weight`** biases selection. `"You've got this"` is safe anywhere and earns a higher weight; `"One small step today still counts"` is situational and earns 1.

**`is_active`** retires copy without deleting it. A line that lands badly is switched off with one `update`, and stays in history.

RLS: readable by any authenticated user, writable by nobody. This is reference data, seeded and edited by migration or by hand in SQL.

### `nudge_kind` gains `support`

`alter type nudge_kind add value if not exists 'support'` — the pattern `event_type` has used five times.

A tough-day check-in currently sends `keep_going`, the same kind as "keep going on your goal". Those want genuinely different tones: someone who has said today was hard should not be told to push harder. `support` separates them.

## Selection

`pickNudgeMessage` is pure, dependency-free and unit-tested with `node:test`, matching `needsAttention` / `stepGoal` / `moments` / `tiers`.

```ts
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

export function pickNudgeMessage(
  messages: readonly NudgeMessage[],
  kind: string,
  context: NudgeContext,
  recentIds: readonly string[],
  random: number,          // 0..1, injected so tests pin the choice
): { id: string; body: string } | null;
```

Order of operations:

1. Filter to `kind`, and to messages whose every placeholder is satisfied by `context`.
2. Drop anything in `recentIds`. **If that empties the pool, ignore `recentIds`** — a repeat beats no message.
3. Weighted random pick using `random`.
4. Substitute `{name}`, `{goal}`, `{streak}`.

Returns `null` only when no message of that kind exists at all, which the seed makes impossible for the six real kinds.

**`recentIds` holds the last 5 message ids shown, in memory, per session.** Immediate repetition is what people notice; overall variety is invisible by comparison. Not persisted — a repeat across app launches is not the one that registers.

## Delivery

`useNudgeMessages()` fetches the whole table once per session with React Query and a long `staleTime`. Seeded copy does not change mid-session, so one fetch is enough and every nudge after it is instant and local.

Offline is not a concern: sending a nudge writes rows to Postgres, so the network is already required.

## Volume

Roughly **70 messages**, weighted toward where traffic actually goes:

| kind | count | where it fires |
|---|---|---|
| `support` | 15 | Circle Today, tough-day check-in |
| `cheer` | 15 | member rows, Circle Today, Today feed |
| `keep_going` | 15 | quiet members, Today feed |
| `water` | 6 | Today feed nudge picker |
| `walk` | 6 | Today feed nudge picker |
| `workout` | 6 | Today feed nudge picker |
| `streak` | 6 | Today feed nudge picker |

Fifteen is where repetition stops being noticeable at realistic frequency. Six is enough for the four situational kinds, which fire rarely.

Deliberately **not 150**. Writing that much before knowing whether the voice is right is the expensive mistake; expanding a table is one `insert`.

Every kind is covered from day one — the Today feed offers all six, so seeding only the busy three would leave four buttons with nothing to pick.

## The voice — full `support` bucket for review

This is the tone the other buckets follow. Read it before the rest is written; adjusting it now costs nothing.

| body | placeholders | weight |
|---|---|---|
| Thinking of you today. | | 3 |
| No pressure today. I'm here. | | 3 |
| Rough days happen. Glad you said something. | | 2 |
| Hey {name} — here if you want to talk. | `{name}` | 3 |
| You don't have to do anything today. | | 2 |
| Sending you something good, {name}. | `{name}` | 2 |
| Tomorrow gets to be different. | | 2 |
| That sounds hard. I'm around. | | 2 |
| Be kind to yourself today. | | 3 |
| You showed up and said it. That counts. | | 1 |
| Take the day off if you need it, {name}. | `{name}` | 1 |
| Still in your corner. | | 3 |
| Nothing to fix. Just checking in. | | 2 |
| Hope tonight's a bit lighter. | | 1 |
| Whatever today was, it's allowed. | | 1 |

Notes on the voice: no exclamation-heavy cheerfulness at someone having a bad day, no advice, no "you've got this" (which reads as pressure here — that line belongs in `keep_going`). About a third carry `{name}`, so the pool mixes addressed and unaddressed.

## Callers

`generateNudgeMessage(kind, recipientName, context?)` — an async call returning a string — is replaced by the synchronous picker plus the fetched table. Two call sites change:

- **`useNudgeMember`** (`src/hooks/useNudgeMember.ts`) currently passes a prose `context` string built by its callers. That becomes a structured `NudgeContext`: `{ name: targetName, streak?: number }`.
- **`TodayScreen`** passes `goalTitleFromEvent(event)`, which becomes `{ name: recipientName, goal?: string }`.

`CircleTodaySection` also changes which kind it sends: a `tough_day` row currently sends `keep_going`, and now sends **`support`**. `quiet` continues to send `cheer`.

The prose-context strings the callers assemble today (`'they said today was a tough one'`, `` `they are on a ${streak}-day streak` ``) disappear — they existed only to feed a prompt.

## What is deleted

- `supabase/functions/generate-nudge-message/` — the whole function. Its Dashboard deployment (slug `smooth-responder`) is deleted by hand.
- `FALLBACK_MESSAGES` in `src/lib/nudgeMessage.ts` — the table is the source now, not a fallback to it.
- The `'nudge'` rate-limit rows in `increment_ai_usage` become dead. `circle-ai-insight` and `weekly-recap` keep using that RPC untouched — they summarise real data, which a fixed library cannot do.

No `ANTHROPIC_API_KEY` dependency for nudges, no per-call cost, no daily cap, no round trip after first load, and nothing that can invent an event.

## Out of scope

- **Tags** (`gentle` / `playful` / `serious`). The `placeholders` array proves the schema takes new dimensions without pain; add a `tags text[]` when there is a reason to filter on one.
- **Time and state conditions** (`morning`, `weekend`, `long_streak`, `first_week`). Genuinely appealing and still deterministic and local — but it needs a condition vocabulary and an evaluator, and the library should prove itself first.
- **Per-user history.** `recentIds` is per session and in memory. Tracking what each person has been sent across launches means a table and a write per nudge, to fix a problem nobody has reported.
- **`circle-ai-insight` and `weekly-recap`.** Both stay on the API. They summarise real circle data; a fixed library cannot.

## Success criteria

- No API call, no API key, and no per-nudge cost anywhere in the nudge path.
- A nudge is written with no network round trip beyond the inserts it already does.
- No message can render an unsubstituted or empty placeholder.
- The same message never appears twice in a row within a session unless the pool is exhausted.
- Any line can be reworded, or retired, with one SQL statement and no app release.
