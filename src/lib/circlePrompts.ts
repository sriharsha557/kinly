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
