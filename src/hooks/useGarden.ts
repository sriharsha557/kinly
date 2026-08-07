import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { calendarDaysSince } from '../lib/needsAttention';
import { growthVisual } from '../lib/gardenGrowth';
import { useMemberActivity } from './useMemberActivity';
import { EMPTY_ACTIVITY } from '../lib/memberActivity';

export type GardenStage = 'wilted' | 'seed' | 'sprout' | 'tree' | 'bloom';

export interface MemberGardenState {
  userId: string;
  name: string;
  stage: GardenStage;
  streak: number;
}

export interface GardenState {
  members: MemberGardenState[];
  health: number;
}

function stageFor(maxStreak: number, mostRecentDate: string | null): GardenStage {
  if (!mostRecentDate) return 'wilted';
  // Shares calendarDaysSince with needsAttention deliberately: this `days > 3`
  // wilt threshold and that module's "quiet" threshold have to agree, or a
  // member shows a drooping plant here while being absent from Circle Today.
  // They can only agree if they count days the same way - the previous
  // millisecond division against a UTC-parsed date drifted with the viewer's
  // timezone, so the two could disagree for several hours a day.
  const days = calendarDaysSince(mostRecentDate, Date.now());
  if (days > 3) return 'wilted';
  // The 3/14/30 thresholds used to be repeated here, with gardenGrowth.ts
  // carrying a second copy the two had to keep in step by hand. That module
  // owns them now; this one keeps only 'wilted', which is a passage of time
  // rather than a streak and so has no business living in the growth model.
  return growthVisual(maxStreak).stage;
}

export function useGardenState(circleId: string | undefined) {
  const { activity } = useMemberActivity(circleId);
  const membersQuery = useQuery({
    queryKey: ['garden-members', circleId],
    enabled: !!circleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('user_id, profiles(name)')
        .eq('circle_id', circleId as string)
        .eq('status', 'active');
      if (error) throw error;
      return data ?? [];
    },
  });

  const data: GardenState | undefined = useMemo(() => {
    if (!membersQuery.data) return undefined;
    const members: MemberGardenState[] = membersQuery.data.map((m) => {
      const agg = activity.get(m.user_id) ?? EMPTY_ACTIVITY;
      const profile = m.profiles as unknown as { name: string } | null;
      return {
        userId: m.user_id,
        name: profile?.name ?? 'Member',
        // Same two inputs as before - a best streak and a most recent date -
        // but sourced from the check-in ledger rather than from
        // goals.streak_count / last_logged_date, which nothing writes for a
        // cadence commitment.
        stage: stageFor(agg.bestStreak, agg.lastCheckinDate),
        streak: agg.bestStreak,
      };
    });
    const activeCount = members.filter((m) => m.stage !== 'wilted').length;
    const health = members.length > 0 ? Math.round((activeCount / members.length) * 100) : 0;
    return { members, health };
  }, [membersQuery.data, activity]);

  return { ...membersQuery, data };
}
