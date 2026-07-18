import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Goal, InterestCategory } from '../types/models';

export function useGoals(circleId: string | undefined) {
  return useQuery({
    queryKey: ['goals', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('circle_id', circleId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });
}

interface NewGoal {
  circleId: string;
  userId: string;
  title: string;
  target: number;
  category?: InterestCategory | null;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, userId, title, target, category }: NewGoal): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .insert({ circle_id: circleId, user_id: userId, title, target, category: category ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      circleId,
      title,
      target,
    }: {
      goalId: string;
      circleId: string;
      title: string;
      target: number;
    }): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .update({ title, target })
        .eq('id', goalId)
        .select()
        .single();
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId }: { goalId: string; circleId: string }) => {
      const { error } = await supabase.from('goals').update({ deleted_at: new Date().toISOString() }).eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}

export function useLogGoalProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      circleId,
      increment,
    }: {
      goalId: string;
      circleId: string;
      increment: number;
    }): Promise<Goal> => {
      const { data, error } = await supabase.rpc('log_goal_progress', {
        p_goal_id: goalId,
        p_increment: increment,
      });
      if (error) throw error;
      return data as Goal;
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}
