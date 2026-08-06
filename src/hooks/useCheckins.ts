import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { toIsoDate } from '../lib/periods';

// Check-ins for every goal in a circle, keyed by goal_id, as plain
// YYYY-MM-DD strings - which is exactly the shape isShowingUp, streak and
// consistency take, so no caller has to reshape it.
//
// Bounded to the last 120 days. No cadence looks back further than a month,
// and streaks only need enough history to find their first gap; without a
// bound this query grows forever and is refetched on every focus.
const CHECKIN_WINDOW_DAYS = 120;

export function useGoalCheckins(circleId: string | undefined) {
  return useQuery({
    queryKey: ['goal-checkins', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const since = new Date();
      since.setDate(since.getDate() - CHECKIN_WINDOW_DAYS);

      const { data, error } = await supabase
        .from('goal_checkins')
        .select('goal_id, checkin_date, goals!inner(circle_id)')
        .eq('goals.circle_id', circleId as string)
        .gte('checkin_date', toIsoDate(since))
        .order('checkin_date', { ascending: false });
      if (error) throw error;

      const byGoal: Record<string, string[]> = {};
      for (const row of (data ?? []) as { goal_id: string; checkin_date: string }[]) {
        (byGoal[row.goal_id] ??= []).push(row.checkin_date.slice(0, 10));
      }
      return byGoal;
    },
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, userId }: { goalId: string; circleId: string; userId: string }) => {
      // Plain .insert(), NEVER .upsert().
      //
      // goal_checkins deliberately has no UPDATE policy (migration 0046) -
      // it is an append-only ledger. supabase-js .upsert() without
      // ignoreDuplicates emits ON CONFLICT DO UPDATE, which RLS rejects with
      // 42501, so the core action of the app would fail for every user on
      // the second tap of a day.
      //
      // The installed @supabase/supabase-js (2.110.8) only exposes
      // ignoreDuplicates on .upsert(), not on .insert() - so ON CONFLICT DO
      // NOTHING isn't reachable from a plain insert call here. Instead we
      // let the unique (goal_id, checkin_date) constraint reject the repeat
      // row with Postgres error 23505 (unique_violation) and swallow just
      // that code, which needs no UPDATE policy and gives the same
      // harmless-no-op behaviour on a repeat tap.
      //
      // checkin_date is left to its DEFAULT current_date. RLS enforces
      // checkin_date <= current_date, so a client clock running fast would
      // have its check-in rejected outright if we sent the date ourselves.
      const { error } = await supabase
        .from('goal_checkins')
        .insert({ goal_id: goalId, user_id: userId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goal-checkins', variables.circleId] });
    },
  });
}

// Undo is a delete, which the ledger does allow (members delete their own
// rows). Mis-tapping a check-in on someone else's behalf is impossible, so
// the only person this can affect is the one who tapped.
export function useUndoCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, date }: { goalId: string; circleId: string; date: string }) => {
      const { data, error } = await supabase
        .from('goal_checkins')
        .delete()
        .eq('goal_id', goalId)
        .eq('checkin_date', date)
        .select('id');
      if (error) throw error;
      // A delete that matches no rows succeeds with error === null, which is
      // also what RLS produces for someone else's row. Without this the UI
      // would report success and change nothing - indistinguishable from
      // undo being broken. Same reasoning as useDeleteGoal in useGoals.ts.
      if (!data || data.length === 0) {
        throw new Error("That check-in isn't yours to undo.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['goal-checkins', variables.circleId] });
    },
  });
}
