export const STORY_PROMPTS: string[] = [
  'Describe your dream vacation in one sentence.',
  'Once upon a time, this circle discovered a hidden treasure...',
  'The strangest thing that could happen at our next meetup is...',
  'If our circle started a business together, it would be...',
  'The worst superpower to have would be...',
  'Our circle got stranded on a desert island, and the first thing we did was...',
  'One day, everyone in this circle woke up famous for...',
];

export function randomStoryPrompt(): string {
  return STORY_PROMPTS[Math.floor(Math.random() * STORY_PROMPTS.length)];
}
