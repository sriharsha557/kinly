import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { WouldYouRatherChoice, WouldYouRatherPoll } from '../types/models';

export interface PollWithVotes extends WouldYouRatherPoll {
  votesA: number;
  votesB: number;
  myChoice: WouldYouRatherChoice | null;
}

export function useLatestPoll(circleId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['wyrPoll', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<PollWithVotes | null> => {
      const { data: poll, error } = await supabase
        .from('would_you_rather_polls')
        .select('*')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!poll) return null;

      const { data: votes, error: votesError } = await supabase
        .from('would_you_rather_votes')
        .select('user_id, choice')
        .eq('poll_id', poll.id);
      if (votesError) throw votesError;

      const votesA = (votes ?? []).filter((v) => v.choice === 'a').length;
      const votesB = (votes ?? []).filter((v) => v.choice === 'b').length;
      const myChoice = (votes ?? []).find((v) => v.user_id === userId)?.choice as WouldYouRatherChoice | undefined;

      return { ...(poll as WouldYouRatherPoll), votesA, votesB, myChoice: myChoice ?? null };
    },
  });
}

export function useCreatePoll(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, optionA, optionB }: { userId: string; optionA: string; optionB: string }) => {
      const { error } = await supabase
        .from('would_you_rather_polls')
        .insert({ circle_id: circleId, option_a: optionA, option_b: optionB, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wyrPoll', circleId] }),
  });
}

export function useVotePoll(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pollId,
      userId,
      choice,
    }: {
      pollId: string;
      userId: string;
      choice: WouldYouRatherChoice;
    }) => {
      const { error } = await supabase
        .from('would_you_rather_votes')
        .upsert({ poll_id: pollId, user_id: userId, choice }, { onConflict: 'poll_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wyrPoll', circleId] }),
  });
}
