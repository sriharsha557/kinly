import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

type ReportTargetType = 'nudge' | 'ask_post' | 'ask_reply' | 'user';

export function useReportContent() {
  return useMutation({
    mutationFn: async ({
      targetType,
      targetId,
      reason,
    }: {
      targetType: ReportTargetType;
      targetId: string;
      reason: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('reports')
        .insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
      if (error) throw error;
    },
  });
}

// Blocking hides the blocked user's nudges, ask posts, and ask replies via
// RLS (see migration 0034) - invalidating broadly here just makes it
// disappear immediately instead of waiting for the next natural refetch.
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: user.id, blocked_id: blockedUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['askPosts'] });
      queryClient.invalidateQueries({ queryKey: ['askReplies'] });
    },
  });
}
