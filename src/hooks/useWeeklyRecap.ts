import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface WeeklyRecap {
  goalsCompleted: number;
  streakMilestones: number;
  nudgesSent: number;
  asksPosted: number;
  highlight: string;
}

const WEEKLY_RECAP_FUNCTION = 'weekly-recap';

export function useWeeklyRecap(circleId: string | undefined) {
  return useQuery({
    queryKey: ['weeklyRecap', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<WeeklyRecap> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('type')
        .eq('circle_id', circleId as string)
        .gte('created_at', since);
      if (eventsError) throw eventsError;

      const goalsCompleted = (events ?? []).filter((e) => e.type === 'goal_completed').length;
      const streakMilestones = (events ?? []).filter((e) => e.type === 'streak').length;
      const asksPosted = (events ?? []).filter((e) => e.type === 'ask').length;

      const { count: nudgesSent, error: nudgesError } = await supabase
        .from('nudges')
        .select('id, events!inner(circle_id)', { count: 'exact', head: true })
        .eq('events.circle_id', circleId as string)
        .gte('created_at', since);
      if (nudgesError) throw nudgesError;

      const stats = { goalsCompleted, streakMilestones, nudgesSent: nudgesSent ?? 0, asksPosted };

      let highlight = '';
      try {
        const { data, error } = await supabase.functions.invoke(WEEKLY_RECAP_FUNCTION, { body: stats });
        if (!error && data?.highlight) highlight = data.highlight as string;
      } catch {
        // Numbers still render without the AI highlight line if the function isn't deployed yet.
      }

      return { ...stats, highlight };
    },
  });
}
