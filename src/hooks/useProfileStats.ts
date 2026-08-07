import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Achievement } from '../types/models';
import { useMemberActivity } from './useMemberActivity';

interface ProfileStats {
  // Of the member's goals, how many they are showing up for right now (see
  // MemberActivity.showingUp) - not a numeric "progress >= target", which
  // has no meaning for a cadence commitment: there is no number to reach.
  goalsCompleted: number;
  // The member's active goals.
  goalsTotal: number;
  // The member's active goals (unchanged in spirit from before this hook
  // read the check-in ledger).
  activeGoals: number;
  // showingUp / goalCount as a percentage. Guarded against goalCount === 0
  // so a member with no goals reads as 0%, not NaN.
  completionRate: number;
  currentStreak: number;
  achievements: Achievement[];
}

export function useProfileStats(userId: string | undefined, circleId: string | undefined) {
  // The same per-member summary the garden, Circle Today and the weekly
  // recap read, so this screen cannot disagree with them about what a
  // member has been doing.
  const { activity } = useMemberActivity(circleId);

  return useQuery({
    queryKey: ['profileStats', userId, circleId],
    enabled: !!userId && !!circleId,
    queryFn: async (): Promise<ProfileStats> => {
      const [{ data: goals, error: goalsError }, { data: achievements, error: achievementsError }] = await Promise.all([
        supabase.from('goals').select('streak_count').eq('user_id', userId as string).eq('circle_id', circleId as string),
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
      const currentStreak = goalsList.reduce((max, g) => Math.max(max, g.streak_count), 0);

      const memberSummary = activity.get(userId as string);
      const goalsTotal = memberSummary?.goalCount ?? 0;
      const goalsCompleted = memberSummary?.showingUp ?? 0;
      const completionRate = goalsTotal === 0 ? 0 : Math.round((goalsCompleted / goalsTotal) * 100);

      return {
        goalsCompleted,
        goalsTotal,
        activeGoals: goalsTotal,
        completionRate,
        currentStreak,
        achievements: (achievements ?? []) as Achievement[],
      };
    },
  });
}
