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
      // target is nullable since migration 0049: a cadence goal has no
      // numeric target at all, only a check-in ledger. Treating a null
      // target as 0 is wrong twice over - `0 >= null` coerces to `0 >= 0`
      // (true), so every cadence goal would count as "completed" and
      // activeGoals would collapse to 0; and `0 / null` is NaN, which then
      // propagates into completionRate and ProfileScreen renders it
      // literally as "NaN%". Numeric goals only for both figures.
      const numericGoals = goalsList.filter(
        (g): g is typeof g & { target: number } => g.target != null,
      );
      const goalsCompleted = numericGoals.filter((g) => g.progress >= g.target).length;
      const currentStreak = goalsList.reduce((max, g) => Math.max(max, g.streak_count), 0);
      const completionRate =
        numericGoals.length > 0
          ? Math.round(
              (numericGoals.reduce((sum, g) => sum + Math.min(g.progress / g.target, 1), 0) / numericGoals.length) * 100,
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
