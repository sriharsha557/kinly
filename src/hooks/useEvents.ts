import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Event, EventType, Nudge, NudgeKind } from '../types/models';

export interface NudgeWithProfile extends Nudge {
  profiles: { name: string } | null;
}

export interface EventWithProfile extends Event {
  profiles: { name: string } | null;
  nudges: NudgeWithProfile[];
}

const EVENTS_PAGE_SIZE = 20;

// Cursor-based on created_at rather than offset/.range() - offset pagination
// re-numbers every page when a new event lands between fetches (a live
// circle feed gets new rows constantly), which reshuffles/duplicates rows
// across pages. A plain `created_at` cursor can in principle skip/duplicate
// a row on an exact-timestamp tie, but for a small friend circle's event
// feed that's negligible next to the reshuffling offset pagination causes.
export function useEvents(circleId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['events', circleId],
    enabled: !!circleId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<EventWithProfile[]> => {
      let query = supabase
        .from('events')
        .select('*, profiles(name), nudges(*, profiles(name))')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false })
        .limit(EVENTS_PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as EventWithProfile[];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length === EVENTS_PAGE_SIZE ? lastPage[lastPage.length - 1].created_at : undefined,
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

export function useSendNudge(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
      kind,
      message,
    }: {
      eventId: string;
      userId: string;
      kind: NudgeKind;
      message: string;
    }) => {
      const { error } = await supabase
        .from('nudges')
        .insert({ event_id: eventId, from_user_id: userId, kind, message });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', circleId] }),
  });
}
