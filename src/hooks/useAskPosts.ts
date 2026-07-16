import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
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
      const { error } = await supabase
        .from('ask_posts')
        .insert({ circle_id: circleId, user_id: userId, question, goal_id: goalId ?? null });
      if (error) throw error;

      await supabase
        .from('events')
        .insert({ circle_id: circleId, user_id: userId, type: 'ask', payload: { question } });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['askPosts', variables.circleId] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.circleId] });
    },
  });
}

export function useDeleteAskPost(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (askPostId: string) => {
      const { error } = await supabase.from('ask_posts').delete().eq('id', askPostId);
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
