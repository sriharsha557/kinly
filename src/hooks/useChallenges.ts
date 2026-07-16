import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Challenge } from '../types/models';

export interface ChallengeWithProgress extends Challenge {
  progress: number;
  contributors: number;
}

export function useChallenges(circleId: string | undefined) {
  return useQuery({
    queryKey: ['challenges', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<ChallengeWithProgress[]> => {
      const { data: challenges, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!challenges || challenges.length === 0) return [];

      const ids = challenges.map((c) => c.id);
      const { data: logs, error: logsError } = await supabase
        .from('challenge_logs')
        .select('challenge_id, user_id, amount')
        .in('challenge_id', ids);
      if (logsError) throw logsError;

      return challenges.map((c) => {
        const relevant = (logs ?? []).filter((l) => l.challenge_id === c.id);
        const progress = relevant.reduce((sum, l) => sum + l.amount, 0);
        const contributors = new Set(relevant.map((l) => l.user_id)).size;
        return { ...c, progress, contributors };
      });
    },
  });
}

export function useCreateChallenge(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId: cid,
      userId,
      title,
      target,
    }: {
      circleId: string;
      userId: string;
      title: string;
      target: number;
    }) => {
      const { error } = await supabase
        .from('challenges')
        .insert({ circle_id: cid, title, target, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['challenges', circleId] }),
  });
}

export function useLogChallengeContribution(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      userId,
      amount,
    }: {
      challengeId: string;
      userId: string;
      amount: number;
    }) => {
      const { error } = await supabase
        .from('challenge_logs')
        .insert({ challenge_id: challengeId, user_id: userId, amount });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['challenges', circleId] }),
  });
}
