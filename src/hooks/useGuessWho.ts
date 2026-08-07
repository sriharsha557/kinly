import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { GuessWhoPost } from '../types/models';

export interface GuessWhoGuess {
  user_id: string;
  guessed_user_id: string;
}

export interface GuessWhoPostWithGuesses extends GuessWhoPost {
  guess_who_guesses: GuessWhoGuess[];
}

export function useGuessWhoPosts(circleId: string | undefined) {
  return useQuery({
    queryKey: ['guessWho', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<GuessWhoPostWithGuesses[]> => {
      // No `profiles(name)` embed on guess_who_guesses. That table has TWO
      // foreign keys into profiles - user_id (who guessed) and
      // guessed_user_id (who they picked) - so PostgREST cannot resolve a
      // bare `profiles` and rejects the whole request with PGRST201
      // ("more than one relationship was found"). That is a 400 on every
      // fetch, which left `posts` undefined forever: the card sat on its
      // empty state and a posted fact never appeared, for anyone.
      //
      // Nothing rendered the embedded name anyway - GuessWhoCard resolves
      // both ids against useCircleMembers, which it already loads. If a name
      // is ever needed here, it must be disambiguated by constraint, e.g.
      // `profiles!guess_who_guesses_user_id_fkey(name)`.
      const { data, error } = await supabase
        .from('guess_who_posts')
        .select('*, guess_who_guesses(user_id, guessed_user_id)')
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
      // Plain .insert(), NEVER .upsert() - same reasoning as useCheckIn in
      // useCheckins.ts. guess_who_guesses (migration 0018) has SELECT and
      // INSERT policies and no UPDATE policy, but .upsert() emits ON CONFLICT
      // DO UPDATE, which RLS rejects with 42501. A guess is final by design
      // (the card reveals the answer the moment you have one), so the repeat
      // row a double-tap produces is a no-op: let the (post_id, user_id)
      // primary key reject it with 23505 and swallow only that code.
      const { error } = await supabase
        .from('guess_who_guesses')
        .insert({ post_id: postId, user_id: userId, guessed_user_id: guessedUserId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['guessWho', circleId] }),
  });
}
