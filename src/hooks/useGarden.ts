import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
  const days = Math.floor((Date.now() - new Date(mostRecentDate).getTime()) / 86_400_000);
  if (days > 3) return 'wilted';
  if (maxStreak >= 30) return 'bloom';
  if (maxStreak >= 14) return 'tree';
  if (maxStreak >= 3) return 'sprout';
  return 'seed';
}

// Derived entirely from goals.streak_count / last_logged_date - no garden
// table needed, so it can never drift out of sync with actual activity.
export function useGardenState(circleId: string | undefined) {
  return useQuery({
    queryKey: ['garden', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<GardenState> => {
      const [{ data: members, error: membersError }, { data: goals, error: goalsError }] = await Promise.all([
        supabase
          .from('circle_members')
          .select('user_id, profiles(name)')
          .eq('circle_id', circleId as string),
        supabase
          .from('goals')
          .select('user_id, streak_count, last_logged_date')
          .eq('circle_id', circleId as string),
      ]);
      if (membersError) throw membersError;
      if (goalsError) throw goalsError;

      const byUser = new Map<string, { maxStreak: number; mostRecent: string | null }>();
      for (const g of goals ?? []) {
        const entry = byUser.get(g.user_id) ?? { maxStreak: 0, mostRecent: null };
        entry.maxStreak = Math.max(entry.maxStreak, g.streak_count);
        if (g.last_logged_date && (!entry.mostRecent || g.last_logged_date > entry.mostRecent)) {
          entry.mostRecent = g.last_logged_date;
        }
        byUser.set(g.user_id, entry);
      }

      const memberStates: MemberGardenState[] = (members ?? []).map((m) => {
        const agg = byUser.get(m.user_id) ?? { maxStreak: 0, mostRecent: null };
        const profile = m.profiles as unknown as { name: string } | null;
        return {
          userId: m.user_id,
          name: profile?.name ?? 'Member',
          stage: stageFor(agg.maxStreak, agg.mostRecent),
          streak: agg.maxStreak,
        };
      });

      const activeCount = memberStates.filter((m) => m.stage !== 'wilted').length;
      const health = memberStates.length > 0 ? Math.round((activeCount / memberStates.length) * 100) : 0;

      return { members: memberStates, health };
    },
  });
}
