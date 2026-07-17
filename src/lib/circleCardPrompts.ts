// Curated prompt bank for the Daily Circle Card. Deterministic pick per
// circle+day (no server call needed) so every circle sees a consistent
// prompt for the day, and different circles naturally see different ones.
export const CIRCLE_CARD_PROMPTS: string[] = [
  "If money wasn't a problem, what would you build?",
  "What's one habit you're proud of?",
  'What are you most looking forward to this month?',
  "What's a small win from this week nobody else noticed?",
  'What skill do you wish you had more time to practice?',
  "What's the best advice you've ever received?",
  'What would your younger self be surprised about you today?',
  "What's one thing you're grateful for right now?",
  'If you could master any skill overnight, what would it be?',
  "What's a goal you're quietly working toward?",
  'What does a perfect Sunday look like for you?',
  "What's something you learned recently that stuck with you?",
  'Who has influenced you the most this year, and how?',
  "What's a fear you're working on getting past?",
  'What would you do with an unexpected free week?',
  "What's one thing you'd tell your friends more often if you could?",
  'What does success actually look like for you personally?',
  "What's a small thing that made you smile today?",
  'If you wrote a book about your life so far, what would the title be?',
  "What's a risk you're glad you took?",
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function todaysPrompt(circleId: string): { date: string; prompt: string } {
  const date = new Date().toISOString().slice(0, 10);
  const index = hashString(`${circleId}:${date}`) % CIRCLE_CARD_PROMPTS.length;
  return { date, prompt: CIRCLE_CARD_PROMPTS[index] };
}
