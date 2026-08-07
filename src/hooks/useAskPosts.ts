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

// ask_posts.reply_count is a denormalised column maintained by the
// on_ask_reply_created trigger (migration 0004). It was reading 0 on posts
// that visibly had replies, which means the trigger is not incrementing it on
// this database - either it was never applied, or the replies predate it.
//
// Rather than repair the column and hope, the count is derived from the rows
// themselves via a PostgREST count embed, which is correct whether or not the
// trigger ever fires. `*` still selects the stale column, so the mapping below
// deliberately overrides it - nothing should read that value again.
interface AskPostRow extends Omit<AskPostWithProfile, 'reply_count'> {
  reply_count: number;
  ask_replies: { count: number }[] | null;
}

export function useAskPosts(circleId: string | undefined) {
  return useQuery({
    queryKey: ['askPosts', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<AskPostWithProfile[]> => {
      const { data, error } = await supabase
        .from('ask_posts')
        .select('*, profiles(name), goals(title), ask_replies(count)')
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
      return ((data ?? []) as unknown as AskPostRow[]).map((row) => ({
        ...row,
        // PostgREST returns a count embed as [{ count: n }], and as [] when
        // the post has no replies at all.
        reply_count: row.ask_replies?.[0]?.count ?? 0,
      }));
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
      // Step R3. This printing at all means the refetch FIRED; the row count
      // says whether the new reply came back with it. Together with R4 (which
      // renders) these separate the three possibilities: no R3 after R2 means
      // the invalidation never reached a live observer; R3 with an unchanged
      // count means the write is not readable yet; R3 with the new count but
      // no R4 means the data arrived and the component failed to re-render.
      if (debugEnabled('askReplies')) {
        debugLog('askReplies', 'R3. query ran. key:', JSON.stringify(['askReplies', askPostId]), '| rows:', data?.length ?? 0, '| error:', error);
      }
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
      // Step R1. An error here means nothing downstream can work, and until
      // now this path swallowed it into an unhandled rejection.
      debugLog('askReplies', 'R1. insert error:', error);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      // Step R2. Observer count is the decisive field, exactly as it was on
      // the posts path: invalidateQueries only refetches a query that has a
      // live observer, so a key that matches with zero observers would
      // explain "nothing happens until I navigate away and back" precisely -
      // remounting creates the observer that the invalidation needed.
      //
      // circleId is worth printing beside the key it builds: it comes from a
      // hook argument rather than from `variables`, so it is the one part of
      // this key that can silently be undefined while the askReplies key
      // beside it is correct.
      if (debugEnabled('askReplies')) {
        debugLog(
          'askReplies',
          'R2. invalidating:',
          JSON.stringify(['askReplies', variables.askPostId]),
          'and',
          JSON.stringify(['askPosts', circleId]),
          '| observers:',
          JSON.stringify(
            queryClient
              .getQueryCache()
              .findAll({ queryKey: ['askReplies'] })
              .map((q) => ({ key: q.queryKey, observers: q.getObserversCount(), status: q.state.status })),
          ),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['askReplies', variables.askPostId] });
      queryClient.invalidateQueries({ queryKey: ['askPosts', circleId] });
    },
  });
}
