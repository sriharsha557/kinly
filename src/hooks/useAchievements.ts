import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Achievement } from '../types/models';

export function useCreateAchievement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      circleId,
      type,
      title,
    }: {
      userId: string;
      circleId: string;
      type: string;
      title: string;
    }): Promise<Achievement> => {
      const { data, error } = await supabase
        .from('achievements')
        .insert({ user_id: userId, circle_id: circleId, type, title })
        .select()
        .single();
      if (error) throw error;
      return data as Achievement;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['profileStats', variables.userId, variables.circleId] }),
  });
}
