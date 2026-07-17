import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GuessWhoPost } from '../types/models';

export interface GuessWhoGuessWithProfile {
  user_id: string;
  guessed_user_id: string;
  profiles: { name: string } | null;
}

export interface GuessWhoPostWithGuesses extends GuessWhoPost {
  guess_who_guesses: GuessWhoGuessWithProfile[];
}

export function useGuessWhoPosts(circleId: string | undefined) {
  return useQuery({
    queryKey: ['guessWho', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<GuessWhoPostWithGuesses[]> => {
      const { data, error } = await supabase
        .from('guess_who_posts')
        .select('*, guess_who_guesses(user_id, guessed_user_id, profiles(name))')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as GuessWhoPostWithGuesses[];
    },
  });
}

export function useCreateGuessWho(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      fact,
      answerUserId,
    }: {
      userId: string;
      fact: string;
      answerUserId: string;
    }) => {
      const { error } = await supabase
        .from('guess_who_posts')
        .insert({ circle_id: circleId, fact, answer_user_id: answerUserId, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guessWho', circleId] }),
  });
}

export function useSubmitGuess(circleId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      userId,
      guessedUserId,
    }: {
      postId: string;
      userId: string;
      guessedUserId: string;
    }) => {
      const { error } = await supabase
        .from('guess_who_guesses')
        .upsert({ post_id: postId, user_id: userId, guessed_user_id: guessedUserId }, { onConflict: 'post_id,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guessWho', circleId] }),
  });
}
