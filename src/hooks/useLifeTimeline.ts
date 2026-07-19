import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  achieved_at: string;
}

// Derived entirely from the existing achievements table (goal completions
// and streak milestones - see useLogGoalWithCelebration, the only writer)
// - no new table, no manual entries. Not scoped to activeCircleId
// deliberately: this is "my life story" across every circle I'm in, not
// one circle's activity feed.
export function useLifeTimeline(userId: string | undefined) {
  return useQuery({
    queryKey: ['lifeTimeline', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TimelineEntry[]> => {
      const { data, error } = await supabase
        .from('achievements')
        .select('id, type, title, achieved_at')
        .eq('user_id', userId as string)
        .order('achieved_at', { ascending: false });
      if (error) throw error;
      return data as TimelineEntry[];
    },
  });
}
