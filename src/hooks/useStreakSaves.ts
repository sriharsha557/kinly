import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useWaterStreak(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.rpc('water_streak', { p_goal_id: goalId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals', circleId] });
      queryClient.invalidateQueries({ queryKey: ['garden', circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', circleId] });
    },
  });
}

// Lightweight per-goal check for GoalCard's 💧 water-mark badge - "has this
// streak ever been saved" rather than precisely "is the CURRENT streak run
// watered," which would need to trace saved_date against the exact
// unbroken-day range. A cheap, honest-enough v1 signal.
export function useHasWaterMark(goalId: string) {
  return useQuery({
    queryKey: ['streakSaveMark', goalId],
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('streak_saves')
        .select('id', { count: 'exact', head: true })
        .eq('goal_id', goalId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}
