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

// One pass, not three chained replaces: sequential passes re-scan what the
// previous one inserted, so a member whose display name is literally
// "{streak}" would have it substituted again by the next pass. Values are
// user-supplied, so they must be written in, never read back.
function substitute(body: string, context: NudgeContext): string {
  return body.replace(/\{(name|goal|streak)\}/g, (_match, key: 'name' | 'goal' | 'streak') =>
    String(context[key] ?? ''),
  );
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
