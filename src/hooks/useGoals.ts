import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { isStepGoal } from '../lib/stepGoal';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
import type { EndedReason, Goal, GoalSource } from '../types/models';
import type { CadenceDraft } from '../lib/cadence';

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
  areaId: string;
  title: string;
  cadence: CadenceDraft;
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

// The numeric `target` is gone from the manual path. A cadence IS the
// target now - "every day", "4x a week" - and the quantity, where there is
// one, lives in the freetext title ("Walk 10,000 steps"). The old form
// could not save "Meditate" at all without inventing a number, and then
// rendered it as a meaningless "0 / 4" progress bar.
//
// target is still written for health_steps goals, where a device compares a
// real number against it; that path is untouched by this plan.
export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ circleId, userId, areaId, title, cadence }: NewGoal): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          circle_id: circleId,
          user_id: userId,
          area_id: areaId,
          title,
          // target_type must never be null: the column is nullable with no
          // default, and a null cadence makes isShowingUp return false for
          // the life of the goal.
          target_type: cadence.target_type,
          target_count: cadence.target_count,
          target_weekdays: cadence.target_weekdays,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        // 23505 is goals_one_active_per_area: one active goal per member per
        // Area is the model's hard rule, and Postgres reports the violation
        // as an unreadable constraint string. The user needs to know they
        // already have a goal here and can replace it.
        if (error.code === '23505') {
          throw new Error('You already have a goal in this area. Edit that one instead.');
        }
        throw error;
      }

      // Starting a commitment is a moment the circle should see. Feed-only,
      // no push. Deliberately not awaited into the error path: a failed
      // event insert must not roll back a successfully created goal.
      const { error: eventError } = await supabase.from('events').insert({
        circle_id: circleId,
        user_id: userId,
        type: 'goal_started',
        payload: { title, goal_id: (data as Goal).id, area_id: areaId },
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] });
      // Same reason as useLogGoalProgress: a step sync moves streak_count and
      // last_logged_date too, so the garden is stale until it is told.
      queryClient.invalidateQueries({ queryKey: ['garden', variables.circleId] });
    },
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] });
      // The garden is derived from these same rows (useGarden reads
      // streak_count / last_logged_date), but it is a separate query, so
      // without this the hero sat unchanged after a check-in until some
      // later refetch happened to run - the one action the product is built
      // around producing no visible response in the thing that represents it.
      queryClient.invalidateQueries({ queryKey: ['garden', variables.circleId] });
    },
  });
}
