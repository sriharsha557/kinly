import type { InterestCategory } from '../types/models';

export interface GoalSuggestion {
  category: InterestCategory;
  title: string;
  target: number;
}

// Curated starter goals per pillar. The first four "health" entries double as
// the always-available trending set when a user has no matching interests yet.
export const SUGGESTIONS: GoalSuggestion[] = [
  { category: 'health', title: 'Drink 3L of water daily', target: 3 },
  { category: 'health', title: 'Walk 8,000 steps daily', target: 8000 },
  { category: 'health', title: 'Stretch for 10 minutes daily', target: 10 },
  { category: 'health', title: 'Get 15 min of sunlight for vitamin D', target: 15 },
  { category: 'wealth', title: 'Save ₹5,000 this month', target: 5000 },
  { category: 'wealth', title: 'Track every expense for 30 days', target: 30 },
  { category: 'learning', title: 'Read 12 books this year', target: 12 },
  { category: 'learning', title: 'Complete an online course', target: 1 },
  { category: 'ideas', title: 'Validate one startup idea', target: 1 },
  { category: 'relationships', title: 'Call a close friend weekly', target: 4 },
];

const TRENDING_TITLES = new Set([
  'Drink 3L of water daily',
  'Walk 8,000 steps daily',
  'Stretch for 10 minutes daily',
  'Get 15 min of sunlight for vitamin D',
]);

export function pickSuggestions(
  interests: InterestCategory[],
  existingGoalTitles: string[],
  count = 4,
): GoalSuggestion[] {
  const owned = new Set(existingGoalTitles);
  const available = SUGGESTIONS.filter((s) => !owned.has(s.title));

  const matched = available.filter((s) => interests.includes(s.category));
  const trending = available.filter((s) => TRENDING_TITLES.has(s.title) && !matched.includes(s));

  const combined = [...matched, ...trending, ...available.filter((s) => !matched.includes(s) && !trending.includes(s))];
  const deduped = combined.filter((s, i) => combined.findIndex((x) => x.title === s.title) === i);

  return deduped.slice(0, count);
}
