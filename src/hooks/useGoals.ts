import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isStepGoal } from '../lib/stepGoal';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
import type { Goal, GoalCategory, GoalSource } from '../types/models';

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
  category?: GoalCategory | null;
  source?: GoalSource;
}

// An explicit `source` from the caller always wins; otherwise a connected
// device auto-detects. On a device that never connected every goal is
// 'manual', so nothing is ever marked for a sync that cannot happen.
function resolveGoalSource(
  source: GoalSource | undefined,
  title: string,
  target: number,
): GoalSource {
  if (source) return source;
  const connected = useHealthSyncStore.getState().decision === 'connected';
  return connected && isStepGoal(title, target) ? 'health_steps' : 'manual';
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
          goal_source: resolveGoalSource(source, title, target),
        })
        .select()
        .single();
      if (error) throw error;

      // Starting a goal is a moment the circle should see - previously only
      // *finishing* one produced a feed row, so a friend planting something
      // new was invisible until they completed it. Feed-only (migration
      // 0039), so this adds a Moments row and no push. Deliberately not
      // awaited into the error path: a failed event insert must not roll
      // back a successfully created goal.
      const { error: eventError } = await supabase.from('events').insert({
        circle_id: circleId,
        user_id: userId,
        type: 'goal_started',
        payload: { title, goal_id: (data as Goal).id },
      });
      if (eventError) console.warn('goal_started event failed', eventError.message);

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

// Changes only goal_source. Separate from useUpdateGoal, which writes title
// and target and would need both to change one field. Used by the Auto
// badge's undo and by the convert-on-connect pass in useHealthSync.
export function useSetGoalSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goalId,
      circleId,
      source,
    }: {
      goalId: string;
      circleId: string;
      source: GoalSource;
    }) => {
      const { error } = await supabase.from('goals').update({ goal_source: source }).eq('id', goalId);
      if (error) throw error;
      return { circleId };
    },
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId }: { goalId: string; circleId: string }) => {
      // .select() is what makes this honest. An update that matches no rows -
      // which is what RLS produces when the goal is not yours - succeeds with
      // error === null and affects nothing, so the old version reported
      // success, invalidated the list, and left the goal exactly where it
      // was. That is indistinguishable from "delete is broken".
      const { data, error } = await supabase
        .from('goals')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', goalId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This goal belongs to someone else, so it can't be deleted from here.");
      }
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
