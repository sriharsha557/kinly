import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { circlePrompt } from '../lib/circlePrompts';
import type { InterestCategory } from '../types/models';

export interface CircleAIInsight {
  strongest: InterestCategory;
  weakest: InterestCategory | null;
  message: string;
  suggestedChallenge: string | null;
}

// Weeks since the epoch. Only its stability matters, not its absolute value:
// it holds steady for seven days and then moves on, which is exactly what
// keeps the suggested challenge from changing on every render.
function isoWeek(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}

export function useCircleAI(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circleAI', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<CircleAIInsight | null> => {
      const { data: goals, error } = await supabase
        .from('goals')
        .select('category, streak_count')
        .eq('circle_id', circleId as string)
        .not('category', 'is', null);
      if (error) throw error;
      if (!goals || goals.length === 0) return null;

      const totals = new Map<string, number>();
      for (const g of goals) {
        if (!g.category) continue;
        totals.set(g.category, (totals.get(g.category) ?? 0) + g.streak_count);
      }
      if (totals.size === 0) return null;

      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const strongest = sorted[0][0] as InterestCategory;
      const weakestRaw = sorted[sorted.length - 1][0] as InterestCategory;
      const weakest = strongest === weakestRaw ? null : weakestRaw;

      // Curated copy chosen from the same category totals an API used to be
      // sent. The week seed keeps one suggestion in place for seven days.
      const { message, suggestedChallenge } = circlePrompt(strongest, weakest, isoWeek(new Date()));

      return { strongest, weakest, message, suggestedChallenge };
    },
  });
}
