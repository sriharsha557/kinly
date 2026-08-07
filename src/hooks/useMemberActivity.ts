import { useMemo } from 'react';
import { useGoals } from './useGoals';
import { useGoalCheckins } from './useCheckins';
import { memberActivity, type ActivityGoal, type MemberActivity } from '../lib/memberActivity';

// Composes the two queries every derived surface needs, so the garden, the
// attention list and the weekly recap cannot disagree about what a member
// has been doing - they read one map built from one pair of queries, and
// TanStack de-duplicates the underlying fetches by key.
export function useMemberActivity(circleId: string | undefined): {
  activity: Map<string, MemberActivity>;
  isLoading: boolean;
  isError: boolean;
} {
  const goalsQuery = useGoals(circleId);
  const checkinsQuery = useGoalCheckins(circleId);

  const activity = useMemo(() => {
    const goals: ActivityGoal[] = (goalsQuery.data ?? []).map((g) => ({
      id: g.id,
      user_id: g.user_id,
      target_type: g.target_type,
      target_count: g.target_count,
      target_weekdays: g.target_weekdays,
    }));
    // Date.now() is captured per data-change, not per render, so a screen
    // left open across midnight keeps yesterday's idea of "today" until
    // something refetches. Accepted rather than fixed: TanStack's
    // refetch-on-focus corrects it the moment the user returns, and any
    // check-in invalidates the ledger query and recomputes immediately. The
    // alternative - recomputing every render - throws away the memo for a
    // boundary almost nobody is awake to cross.
    return memberActivity(goals, checkinsQuery.data ?? {}, Date.now());
  }, [goalsQuery.data, checkinsQuery.data]);

  return {
    activity,
    isLoading: goalsQuery.isLoading || checkinsQuery.isLoading,
    // Surfaced rather than swallowed: a derived screen that silently renders
    // zeros on a failed query tells the circle nobody is doing anything,
    // which is the single most damaging thing it could say.
    isError: goalsQuery.isError || checkinsQuery.isError,
  };
}
