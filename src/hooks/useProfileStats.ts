import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Achievement } from '../types/models';

interface ProfileStats {
  goalsCompleted: number;
  goalsTotal: number;
  currentStreak: number;
  friendsHelped: number;
  achievements: Achievement[];
}

export function useProfileStats(userId: string | undefined, circleId: string | undefined) {
  return useQuery({
    queryKey: ['profileStats', userId, circleId],
    enabled: !!userId && !!circleId,
    queryFn: async (): Promise<ProfileStats> => {
      const [{ data: goals, error: goalsError }, { count: friendsHelped, error: nudgesError }, { data: achievements, error: achievementsError }] =
        await Promise.all([
          supabase.from('goals').select('progress, target, streak_count').eq('user_id', userId as string).eq('circle_id', circleId as string),
          supabase.from('nudges').select('id', { count: 'exact', head: true }).eq('from_user_id', userId as string),
          supabase
            .from('achievements')
            .select('*')
            .eq('user_id', userId as string)
            .eq('circle_id', circleId as string)
            .order('achieved_at', { ascending: false })
            .limit(6),
        ]);

      if (goalsError) throw goalsError;
      if (nudgesError) throw nudgesError;
      if (achievementsError) throw achievementsError;

      const goalsList = goals ?? [];
      const goalsCompleted = goalsList.filter((g) => g.progress >= g.target).length;
      const currentStreak = goalsList.reduce((max, g) => Math.max(max, g.streak_count), 0);

      return {
        goalsCompleted,
        goalsTotal: goalsList.length,
        currentStreak,
        friendsHelped: friendsHelped ?? 0,
        achievements: (achievements ?? []) as Achievement[],
      };
    },
  });
}
