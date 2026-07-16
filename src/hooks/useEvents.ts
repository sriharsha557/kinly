import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Event, EventType } from '../types/models';

export interface EventWithProfile extends Event {
  profiles: { name: string } | null;
}

export function useEvents(circleId: string | undefined) {
  return useQuery({
    queryKey: ['events', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<EventWithProfile[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*, profiles(name)')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as EventWithProfile[];
    },
  });
}

interface NewEvent {
  circleId: string;
  userId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export function useLogEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, userId, type, payload }: NewEvent) => {
      const { error } = await supabase
        .from('events')
        .insert({ circle_id: circleId, user_id: userId, type, payload });
      if (error) throw error;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['events', variables.circleId] }),
  });
}

export function useSendCheer(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, userId }: { eventId: string; userId: string }) => {
      const { error } = await supabase
        .from('nudges')
        .insert({ event_id: eventId, from_user_id: userId, kind: 'cheer' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', circleId] }),
  });
}
