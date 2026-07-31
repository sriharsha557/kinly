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
