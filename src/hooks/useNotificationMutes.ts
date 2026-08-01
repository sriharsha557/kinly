import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// The two headline switches (docs/superpowers/specs/2026-07-31-notifications-
// design.md). They share notification_mutes with the per-category rows -
// the column is free text, so no migration is needed. A tier switched off
// silences that whole tier; switched on, the per-category mutes below apply.
// Circle management (join requests and approvals) ignores both, matching
// notify-circle's deliberately unmutable 'membership' category.
export const TIER_SWITCHES = [
  { key: 'tier_immediate', label: 'Personal alerts', hint: 'When someone needs you' },
  { key: 'tier_digest', label: 'Daily digest', hint: "Your circle's day, once each evening" },
] as const;

// Only categories that still push belong here. goal_completed, streak,
// challenge_completed and streak_saved moved to the daily digest and are
// feed-only now - toggling a switch for any of them would change nothing,
// which is worse than not offering the switch at all. Digest *content*
// isn't per-category filterable either: the digest is one composed message
// shared by the whole circle, not a per-recipient assembly of the categories
// they still want, so there's no per-category knob to wire up for it.
export const MUTE_CATEGORIES = [
  { key: 'reminder', label: 'Streak at risk / check-ins' },
  { key: 'ask', label: 'Ask posted' },
  { key: 'reply', label: 'Replies' },
  { key: 'nudge', label: 'Nudges received' },
  { key: 'mood_checkin', label: 'Mood check-ins' },
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
