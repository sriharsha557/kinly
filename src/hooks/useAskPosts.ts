import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { debugEnabled, debugLog } from '../lib/debugLog';
import type { AskPost, AskReply } from '../types/models';

export interface AskPostWithProfile extends AskPost {
  profiles: { name: string } | null;
  goals: { title: string } | null;
}

export interface AskReplyWithProfile extends AskReply {
  profiles: { name: string } | null;
}

export function useAskPosts(circleId: string | undefined) {
  return useQuery({
    queryKey: ['askPosts', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<AskPostWithProfile[]> => {
      const { data, error } = await supabase
        .from('ask_posts')
        .select('*, profiles(name), goals(title)')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      // Printing after '5' means the refetch fired and the only question left
      // is whether the new row came back; never printing means the
      // invalidation is not reaching this query at all.
      // JSON.stringify-ing the key is expensive enough to guard explicitly
      // rather than leave to debugLog's internal no-op.
      if (debugEnabled('askPosts')) {
        debugLog('askPosts', '6. query ran. key:', JSON.stringify(['askPosts', circleId]), '| rows:', data?.length ?? 0, '| error:', error);
      }
      if (error) throw error;
      return data as unknown as AskPostWithProfile[];
    },
  });
}

export function useCreateAskPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      userId,
      question,
      goalId,
    }: {
      circleId: string;
      userId: string;
      question: string;
      goalId?: string | null;
    }) => {
      // Deliberately NOT .select()-ing the inserted row. Adding a select here
      // would change the request this path actually makes, so the shape being
      // debugged would stop being the shape that ships. The readback below is
      // a separate, debug-only query for exactly that reason.
      const { error } = await supabase
        .from('ask_posts')
        .insert({ circle_id: circleId, user_id: userId, question, goal_id: goalId ?? null });
      debugLog('askPosts', '1. insert error:', error);
      if (error) throw error;

      // Debug-only readback: distinguishes "the row was written but is not
      // readable" (a SELECT-policy problem) from "the row is readable but the
      // cache never refetched". Never runs in a release build.
      if (__DEV__) {
        const { count, error: readbackError } = await supabase
          .from('ask_posts')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', circleId);
        debugLog('askPosts', '2. rows readable for this circle:', count, '| error:', readbackError);
      }

      const { error: eventError } = await supabase
        .from('events')
        .insert({ circle_id: circleId, user_id: userId, type: 'ask', payload: { question } });
      // This error was previously discarded outright, so a failing events
      // insert was invisible even though it is on the success path.
      debugLog('askPosts', '3. events insert error:', eventError);
    },
    onSuccess: (_data, variables) => {
      debugLog('askPosts', '4. onSuccess. invalidating:', JSON.stringify(['askPosts', variables.circleId]));
      // Observer count is the decisive field: invalidateQueries only refetches
      // queries that have a live observer, so a key that matches with zero
      // observers explains the symptom exactly.
      // Walking and stringifying the whole query cache is expensive enough
      // to guard explicitly rather than leave to debugLog's internal no-op.
      if (debugEnabled('askPosts')) {
        debugLog(
          'askPosts',
          '5. askPosts queries in cache:',
          JSON.stringify(
            queryClient
              .getQueryCache()
              .findAll({ queryKey: ['askPosts'] })
              .map((q) => ({ key: q.queryKey, observers: q.getObserversCount(), status: q.state.status })),
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['askPosts', variables.circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.circleId] });
    },
  });
}

export function useDeleteAskPost(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (askPostId: string) => {
      const { error } = await supabase.rpc('soft_delete_ask_post', { p_ask_post_id: askPostId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['askPosts', circleId] }),
  });
}

export function useAskReplies(askPostId: string | undefined) {
  return useQuery({
    queryKey: ['askReplies', askPostId],
    enabled: !!askPostId,
    queryFn: async (): Promise<AskReplyWithProfile[]> => {
      const { data, error } = await supabase
        .from('ask_replies')
        .select('*, profiles(name)')
        .eq('ask_post_id', askPostId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as AskReplyWithProfile[];
    },
  });
}

export function useCreateReply(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      askPostId,
      userId,
      body,
    }: {
      askPostId: string;
      userId: string;
      body: string;
    }) => {
      const { error } = await supabase.from('ask_replies').insert({ ask_post_id: askPostId, user_id: userId, body });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['askReplies', variables.askPostId] });
      queryClient.invalidateQueries({ queryKey: ['askPosts', circleId] });
    },
  });
}
