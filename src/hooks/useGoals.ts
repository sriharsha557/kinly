import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Goal, GoalSource, InterestCategory } from '../types/models';

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
  source?: GoalSource;
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, userId, title, target, category, source }: NewGoal): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          circle_id: circleId,
          user_id: userId,
          title,
          target,
          category: category ?? null,
          goal_source: source ?? 'manual',
        })
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

export function useSyncStepGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      circleId,
      steps,
    }: {
      goalId: string;
      circleId: string;
      steps: number;
    }): Promise<Goal> => {
      const { data, error } = await supabase.rpc('sync_step_goal', {
        p_goal_id: goalId,
        p_steps: Math.round(steps),
      });
      if (error) throw error;
      return data as Goal;
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
