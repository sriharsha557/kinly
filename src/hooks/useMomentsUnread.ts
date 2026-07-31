import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { countUnreadEvents } from '../lib/moments';

// Reads the viewer's own membership row for its read stamp, then counts how
// many of the circle's recent events postdate it. Deliberately a separate
// query from useEvents: that one is paginated and infinite, and the badge
// needs a stable count independent of how far the user has scrolled.
const UNREAD_WINDOW = 100;

export function useMomentsUnread(circleId: string | undefined, userId: string | undefined) {
  const query = useQuery({
    queryKey: ['momentsUnread', circleId, userId],
    enabled: !!circleId && !!userId,
    queryFn: async (): Promise<{ unreadCount: number; lastReadAt: string | null }> => {
      const { data: membership, error: membershipError } = await supabase
        .from('circle_members')
        .select('last_read_events_at')
        .eq('circle_id', circleId as string)
        .eq('user_id', userId as string)
        .maybeSingle();
      if (membershipError) throw membershipError;

      const lastReadAt = (membership?.last_read_events_at as string | null) ?? null;

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('created_at, user_id')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false })
        .limit(UNREAD_WINDOW);
      if (eventsError) throw eventsError;

      return {
        unreadCount: countUnreadEvents(events ?? [], lastReadAt, userId as string),
        lastReadAt,
      };
    },
  });

  return {
    unreadCount: query.data?.unreadCount ?? 0,
    lastReadAt: query.data?.lastReadAt ?? null,
    // lastReadAt is null both while the query is in flight and when the
    // member genuinely has never read the feed, and those two mean opposite
    // things to the "New" divider. Callers that stamp read state need to
    // wait for this before trusting lastReadAt, or a cold start would treat
    // an already-read feed as entirely unread.
    isLoaded: query.isSuccess,
  };
}

export function useMarkMomentsRead(circleId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!circleId) return;
      const { error } = await supabase.rpc('mark_moments_read', { p_circle_id: circleId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['momentsUnread', circleId, userId] }),
  });
}
