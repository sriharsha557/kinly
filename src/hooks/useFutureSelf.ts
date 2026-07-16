import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { FutureLetter } from '../types/models';

export function useMyLetters(userId: string | undefined) {
  return useQuery({
    queryKey: ['futureLetters', userId],
    enabled: !!userId,
    queryFn: async (): Promise<FutureLetter[]> => {
      const { data, error } = await supabase
        .from('future_letters')
        .select('*')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FutureLetter[];
    },
  });
}

export function useWriteLetter(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const unlockDate = new Date();
      unlockDate.setFullYear(unlockDate.getFullYear() + 1);
      const { error } = await supabase.from('future_letters').insert({
        user_id: userId,
        content,
        unlock_date: unlockDate.toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['futureLetters', userId] }),
  });
}

export function useOpenLetter(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (letterId: string) => {
      const { error } = await supabase
        .from('future_letters')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', letterId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['futureLetters', userId] }),
  });
}
