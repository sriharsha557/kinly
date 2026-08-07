import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Achievement } from '../types/models';
import { useMemberActivity } from './useMemberActivity';

interface ProfileStats {
  // Of the member's goals, how many they are showing up for right now (see
  // MemberActivity.showingUp) - not a numeric "progress >= target", which
  // has no meaning for a cadence commitment: there is no number to reach.
  goalsCompleted: number;
  // The member's active goals.
  goalsTotal: number;
  // The member's active goals (unchanged in spirit from before this hook
  // read the check-in ledger).
  activeGoals: number;
  // showingUp / goalCount as a percentage. Guarded against goalCount === 0
  // so a member with no goals reads as 0%, not NaN.
  completionRate: number;
  currentStreak: number;
  achievements: Achievement[];
}

export function useProfileStats(userId: string | undefined, circleId: string | undefined) {
  // The same per-member summary the garden, Circle Today and the weekly
  // recap read, so this screen cannot disagree with them about what a
  // member has been doing.
  const { activity } = useMemberActivity(circleId);

  // Only the achievements fetch belongs in the query. Everything derived
  // from `activity` is computed below instead: the queryKey names nothing
  // that changes when the goals and check-ins queries resolve, so TanStack
  // would never re-run this function - on a cold mount `activity` is still
  // empty and the zeros it produced were cached permanently. A member on a
  // three-day streak opened Profile and read "0" while the garden two tabs
  // away drew them a sprout.
  const query = useQuery({
    queryKey: ['profileStats', userId, circleId],
    enabled: !!userId && !!circleId,
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', userId as string)
        .eq('circle_id', circleId as string)
        .order('achieved_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Achievement[];
    },
  });

  const derived = useMemo(() => {
    const memberSummary = userId ? activity.get(userId) : undefined;
    // From the ledger, not goals.streak_count - that column is not written
    // for a cadence commitment, so this tile read 0 for someone who had
    // checked in every day for a month. Counted in each goal's own
    // periods, which is why the tile beside it must not name a unit.
    const currentStreak = memberSummary?.bestStreak ?? 0;
    const goalsTotal = memberSummary?.goalCount ?? 0;
    const goalsCompleted = memberSummary?.showingUp ?? 0;
    const completionRate = goalsTotal === 0 ? 0 : Math.round((goalsCompleted / goalsTotal) * 100);
    return { currentStreak, goalsTotal, goalsCompleted, activeGoals: goalsTotal, completionRate };
  }, [activity, userId]);

  const data: ProfileStats | undefined = useMemo(
    () => (query.data ? { ...derived, achievements: query.data } : undefined),
    [query.data, derived],
  );

  return { ...query, data };
}
