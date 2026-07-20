import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Achievement } from '../types/models';

interface ProfileStats {
  goalsCompleted: number;
  goalsTotal: number;
  activeGoals: number;
  // Average fractional progress across all goals (not just the completed
  // ones) - deliberately distinct from goalsCompleted/goalsTotal, which
  // only counts goals that hit 100%. Someone with three goals at 50/80/20%
  // has 0 "done" but a real 50% completion rate worth showing.
  completionRate: number;
  currentStreak: number;
  achievements: Achievement[];
}

export function useProfileStats(userId: string | undefined, circleId: string | undefined) {
  return useQuery({
    queryKey: ['profileStats', userId, circleId],
    enabled: !!userId && !!circleId,
    queryFn: async (): Promise<ProfileStats> => {
      const [{ data: goals, error: goalsError }, { data: achievements, error: achievementsError }] = await Promise.all([
        supabase.from('goals').select('progress, target, streak_count').eq('user_id', userId as string).eq('circle_id', circleId as string),
        supabase
          .from('achievements')
          .select('*')
          .eq('user_id', userId as string)
          .eq('circle_id', circleId as string)
          .order('achieved_at', { ascending: false })
          .limit(6),
      ]);

      if (goalsError) throw goalsError;
      if (achievementsError) throw achievementsError;

      const goalsList = goals ?? [];
      const goalsCompleted = goalsList.filter((g) => g.progress >= g.target).length;
      const currentStreak = goalsList.reduce((max, g) => Math.max(max, g.streak_count), 0);
      const completionRate =
        goalsList.length > 0
          ? Math.round(
              (goalsList.reduce((sum, g) => sum + Math.min(g.progress / g.target, 1), 0) / goalsList.length) * 100,
            )
          : 0;

      return {
        goalsCompleted,
        goalsTotal: goalsList.length,
        activeGoals: goalsList.length - goalsCompleted,
        completionRate,
        currentStreak,
        achievements: (achievements ?? []) as Achievement[],
      };
    },
  });
}
