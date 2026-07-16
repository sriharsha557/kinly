import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { InterestCategory } from '../types/models';

export interface CircleAIInsight {
  strongest: InterestCategory;
  weakest: InterestCategory | null;
  message: string;
  suggestedChallenge: string | null;
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

      let message = '';
      let suggestedChallenge: string | null = null;
      try {
        const { data, error: fnError } = await supabase.functions.invoke('circle-ai-insight', {
          body: { strongest, weakest, categoryTotals: Object.fromEntries(totals) },
        });
        if (!fnError && data) {
          message = (data.message as string) ?? '';
          suggestedChallenge = (data.suggestedChallenge as string) ?? null;
        }
      } catch {
        // No AI line yet if the function isn't deployed - card just won't render (see CircleAICard).
      }

      return { strongest, weakest, message, suggestedChallenge };
    },
  });
}
