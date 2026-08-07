import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { weeklyHighlight } from '../lib/weeklyHighlight';
import { useMemberActivity } from './useMemberActivity';

export interface WeeklyRecap {
  goalsCompleted: number;
  streakMilestones: number;
  nudgesSent: number;
  asksPosted: number;
  highlight: string;
  // Scorecard additions (Feature 6) - all derived from existing tables
  // except healthWeekAgo, which needs circle_health_snapshots (migration
  // 0027) since Garden health has no other stored history to diff against.
  bestStreak: number;
  mostWateredFriendName: string | null;
  healthNow: number;
  healthWeekAgo: number | null;
}

export function useWeeklyRecap(circleId: string | undefined) {
  // The circle's per-member summary, sourced from goals + the check-in
  // ledger - the same map the garden and Circle Today read, so this card
  // cannot disagree with them about who has been showing up.
  const { activity } = useMemberActivity(circleId);

  return useQuery({
    queryKey: ['weeklyRecap', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<WeeklyRecap> => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('type')
        .eq('circle_id', circleId as string)
        .gte('created_at', since);
      if (eventsError) throw eventsError;

      const goalsCompleted = (events ?? []).filter((e) => e.type === 'goal_completed').length;
      const streakMilestones = (events ?? []).filter((e) => e.type === 'streak').length;
      const asksPosted = (events ?? []).filter((e) => e.type === 'ask').length;

      const { count: nudgesSent, error: nudgesError } = await supabase
        .from('nudges')
        .select('id, events!inner(circle_id)', { count: 'exact', head: true })
        .eq('events.circle_id', circleId as string)
        .gte('created_at', since);
      if (nudgesError) throw nudgesError;

      // Best streak across the circle, from the check-in ledger rather than
      // goals.streak_count, which the ledger never writes. This is a max
      // across goals in different cadences (a 5-day daily streak and a
      // 2-month monthly streak are not the same unit) - accepted, which is
      // why no copy below states "days".
      let bestStreak = 0;
      for (const memberActivity of activity.values()) {
        bestStreak = Math.max(bestStreak, memberActivity.bestStreak);
      }

      const { data: waters } = await supabase
        .from('streak_saves')
        .select('to_user_id, profiles!streak_saves_to_user_id_fkey(name)')
        .eq('circle_id', circleId as string)
        .gte('created_at', since);
      const waterCounts = new Map<string, { name: string; count: number }>();
      for (const w of waters ?? []) {
        const id = w.to_user_id as string;
        const name = (w as unknown as { profiles: { name: string } | null }).profiles?.name ?? 'Someone';
        const entry = waterCounts.get(id) ?? { name, count: 0 };
        entry.count += 1;
        waterCounts.set(id, entry);
      }
      const mostWatered = [...waterCounts.values()].sort((a, b) => b.count - a.count)[0];
      const mostWateredFriendName = mostWatered?.name ?? null;

      const { data: members } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId as string)
        .eq('status', 'active');
      // Most recent check-in per member, from the same activity map -
      // replaces the old goals.last_logged_date read, which the ledger
      // never writes.
      const totalMembers = members?.length ?? 0;
      const activeMembers = (members ?? []).filter((m) => {
        const mostRecent = activity.get(m.user_id)?.lastCheckinDate;
        if (!mostRecent) return false;
        const daysSince = Math.floor((Date.now() - new Date(mostRecent).getTime()) / 86_400_000);
        return daysSince <= 3;
      }).length;
      const healthNow = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

      const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const { data: snapshot } = await supabase
        .from('circle_health_snapshots')
        .select('health')
        .eq('circle_id', circleId as string)
        .lte('snapshotted_at', weekAgoIso)
        .order('snapshotted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const healthWeekAgo = snapshot?.health ?? null;

      const stats = { goalsCompleted, streakMilestones, nudgesSent: nudgesSent ?? 0, asksPosted };

      // Assembled locally from the numbers just computed above, rather than
      // sent to an API to be phrased. No network call, so nothing here can
      // fail and no tolerate-failure path is needed.
      const highlight = weeklyHighlight({
        ...stats,
        bestStreak,
        mostWateredFriendName,
        healthNow,
        healthWeekAgo,
      });

      return { ...stats, highlight, bestStreak, mostWateredFriendName, healthNow, healthWeekAgo };
    },
  });
}
