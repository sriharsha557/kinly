import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Challenge } from '../types/models';

// A challenge's progress is the sum of an append-only log, so the same
// person contributing twice is legitimate rather than a duplicate. The bar
// alone cannot say that: it shows one number climbing with no indication of
// who moved it, which reads as "my tap was counted twice". Rolling the log
// up per member is what makes a repeat contribution legible as a repeat
// contribution.
export interface ChallengeContribution {
  user_id: string;
  name: string;
  amount: number;
}

export interface ChallengeWithProgress extends Challenge {
  progress: number;
  contributors: number;
  contributions: ChallengeContribution[];
}

interface ChallengeLogRow {
  challenge_id: string;
  user_id: string;
  amount: number;
  profiles: { name: string } | null;
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
      // challenge_logs has exactly one foreign key into profiles (user_id),
      // so a bare `profiles(name)` embed resolves unambiguously here - unlike
      // guess_who_guesses, which has two and needs the constraint spelled out.
      const { data: logs, error: logsError } = await supabase
        .from('challenge_logs')
        .select('challenge_id, user_id, amount, profiles(name)')
        .in('challenge_id', ids);
      if (logsError) throw logsError;

      const rows = (logs ?? []) as unknown as ChallengeLogRow[];

      return challenges.map((c) => {
        const relevant = rows.filter((l) => l.challenge_id === c.id);
        const progress = relevant.reduce((sum, l) => sum + l.amount, 0);

        const byMember = new Map<string, ChallengeContribution>();
        for (const log of relevant) {
          const existing = byMember.get(log.user_id);
          if (existing) {
            existing.amount += log.amount;
          } else {
            byMember.set(log.user_id, {
              user_id: log.user_id,
              name: log.profiles?.name ?? 'Someone',
              amount: log.amount,
            });
          }
        }
        const contributions = [...byMember.values()].sort((a, b) => b.amount - a.amount);

        return { ...c, progress, contributors: contributions.length, contributions };
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
