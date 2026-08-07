import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EndedReason, Goal, GoalSource } from '../types/models';
import type { CadenceDraft } from '../lib/cadence';

export function useGoals(circleId: string | undefined) {
  return useQuery({
    queryKey: ['goals', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Goal[]> => {
      // useEndGoal sets status='ended' on the user's own action (completed /
      // deleted) and that must disappear immediately, or the button that
      // just fired looks like it did nothing and stays tappable for a
      // second, contradictory history row. But migration 0047 also set
      // status='ended' on every goal whose old category could not be mapped
      // to an Area - a blanket `.eq('status', 'active')` would make that
      // whole slice of every circle's goals vanish in one release, before
      // anyone has decided what should happen to them. So this stays
      // narrower than the real filter on purpose: hide only what a member
      // ended themselves, leave migration-ended goals visible until that
      // product decision lands, then switch to `.eq('status', 'active')`.
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('circle_id', circleId as string)
        .or('status.eq.active,ended_reason.eq.migration')
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

// resolveGoalSource lived here and auto-detected a step goal at creation
// time from its title and its numeric target. Areas of Growth removed the
// numeric target from the manual path, and isStepGoal cannot recognise a
// step goal without a number, so there is nothing left to detect from and
// the function had no caller.
//
// Step goals are not lost: useHealthSync still runs a convert-on-connect
// pass over goals that already carry a target. What is gone is auto-marking
// a NEWLY created commitment, and it stays gone until a later plan moves
// step sync onto the check-in ledger, which is where it belongs anyway.

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
      title,
      cadence,
    }: {
      goalId: string;
      circleId: string;
      title: string;
      cadence: CadenceDraft;
    }): Promise<Goal> => {
      const { data, error } = await supabase
        .from('goals')
        .update({
          title,
          target_type: cadence.target_type,
          target_count: cadence.target_count,
          target_weekdays: cadence.target_weekdays,
        })
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

// Ending a commitment: archive it, then mark it ended. Never delete the
// goals row - events, streak_saves, buddy check-ins, challenges and the life
// timeline all reference goal_id.
//
// A goal with no check-ins writes NO history row at all. Nothing happened,
// so there is nothing to remember, and a "Previous Goals" list padded with
// commitments nobody ever acted on is noise.
export function useEndGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      goal,
      reason,
      bestStreak,
      hadCheckins,
    }: {
      goal: Goal;
      circleId: string;
      reason: EndedReason;
      bestStreak: number;
      hadCheckins: boolean;
    }) => {
      if (hadCheckins) {
        const { error: historyError } = await supabase.from('goal_history').insert({
          goal_id: goal.id,
          circle_id: goal.circle_id,
          user_id: goal.user_id,
          area_id: goal.area_id,
          title: goal.title,
          target_type: goal.target_type,
          target_count: goal.target_count,
          target_weekdays: goal.target_weekdays,
          started_at: goal.started_at,
          best_streak: bestStreak,
          ended_reason: reason,
        });
        // The history insert is where someone else's goal actually fails:
        // goal_history's insert policy checks user_id = auth.uid() and
        // is_circle_member, so it rejects with 42501 before the update below
        // is ever reached. Without this the friendly copy on the update path
        // would be unreachable for any goal that has check-ins, and the user
        // would get a raw Postgres RLS string instead.
        if (historyError) {
          if (historyError.code === '42501') {
            throw new Error("This goal belongs to someone else, so it can't be ended from here.");
          }
          throw historyError;
        }
      }

      // .select() is what makes this honest. An update that matches no rows
      // - which is what RLS produces when the goal is not yours - succeeds
      // with error === null and changes nothing, so without this the UI
      // reports success and leaves the goal exactly where it was.
      const { data, error } = await supabase
        .from('goals')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString().slice(0, 10),
          ended_reason: reason,
        })
        .eq('id', goal.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("This goal belongs to someone else, so it can't be ended from here.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goals', variables.circleId] });
      queryClient.invalidateQueries({ queryKey: ['goal-history', variables.circleId] });
    },
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
      // The garden is derived from the goals and goal-checkins queries now,
      // not a ['garden', circleId] query of its own, so invalidating those is
      // what refreshes it.
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
      // The garden is derived from the goals and goal-checkins queries now,
      // not a ['garden', circleId] query of its own, so invalidating those is
      // what refreshes it.
    },
  });
}
