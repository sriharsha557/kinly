import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export const MUTE_CATEGORIES = [
  { key: 'goal_completed', label: 'Goal milestones' },
  { key: 'streak', label: 'Streak achieved' },
  { key: 'reminder', label: 'Streak at risk / check-ins' },
  { key: 'ask', label: 'Ask posted' },
  { key: 'reply', label: 'Replies' },
  { key: 'nudge', label: 'Nudges received' },
  { key: 'challenge_completed', label: 'Challenge completed' },
  { key: 'mood_checkin', label: 'Mood check-ins' },
  { key: 'streak_saved', label: 'Streak saves' },
] as const;

export function useNotificationMutes(circleId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['notificationMutes', circleId, userId],
    enabled: !!circleId && !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('notification_mutes')
        .select('category')
        .eq('circle_id', circleId as string)
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data ?? []).map((row) => row.category as string);
    },
  });
}

export function useToggleMute(circleId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ category, muted }: { category: string; muted: boolean }) => {
      if (muted) {
        const { error } = await supabase
          .from('notification_mutes')
          .insert({ circle_id: circleId, user_id: userId, category });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_mutes')
          .delete()
          .eq('circle_id', circleId as string)
          .eq('user_id', userId as string)
          .eq('category', category);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificationMutes', circleId, userId] }),
  });
}
