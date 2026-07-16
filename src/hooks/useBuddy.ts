import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateNudgeMessage } from '../lib/nudgeMessage';

export interface BuddyPair {
  buddy_id: string;
  buddy_name: string;
}

export function useMyBuddy(circleId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['buddy', circleId, userId],
    enabled: !!circleId && !!userId,
    queryFn: async (): Promise<BuddyPair | null> => {
      const { data, error } = await supabase
        .from('buddy_pairs')
        .select('buddy_id, profiles!buddy_pairs_buddy_id_fkey(name)')
        .eq('circle_id', circleId as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const profile = data.profiles as unknown as { name: string } | null;
      return { buddy_id: data.buddy_id, buddy_name: profile?.name ?? 'Buddy' };
    },
  });
}

export function useSetBuddy(circleId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (buddyId: string) => {
      const { error } = await supabase
        .from('buddy_pairs')
        .upsert({ circle_id: circleId, user_id: userId, buddy_id: buddyId }, { onConflict: 'circle_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['buddy', circleId, userId] }),
  });
}

export function useCheckInOnBuddy(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      buddyId,
      buddyName,
      fromUserId,
    }: {
      buddyId: string;
      buddyName: string;
      fromUserId: string;
    }) => {
      const { data: event, error } = await supabase
        .from('events')
        .insert({
          circle_id: circleId,
          user_id: buddyId,
          type: 'reminder',
          payload: { message: 'Your buddy is checking in on you' },
        })
        .select()
        .single();
      if (error) throw error;

      const message = await generateNudgeMessage('keep_going', buddyName);
      await supabase
        .from('nudges')
        .insert({ event_id: event.id, from_user_id: fromUserId, kind: 'keep_going', message });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', circleId] }),
  });
}
