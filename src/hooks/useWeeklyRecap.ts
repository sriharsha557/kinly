import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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

const WEEKLY_RECAP_FUNCTION = 'weekly-recap';

export function useWeeklyRecap(circleId: string | undefined) {
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

      const { data: goalsForStreak } = await supabase
        .from('goals')
        .select('streak_count')
        .eq('circle_id', circleId as string)
        .order('streak_count', { ascending: false })
        .limit(1);
      const bestStreak = goalsForStreak?.[0]?.streak_count ?? 0;

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
      const { data: allGoals } = await supabase
        .from('goals')
        .select('user_id, last_logged_date')
        .eq('circle_id', circleId as string);
      const mostRecentByUser = new Map<string, string>();
      for (const g of allGoals ?? []) {
        if (!g.last_logged_date) continue;
        const existing = mostRecentByUser.get(g.user_id);
        if (!existing || g.last_logged_date > existing) mostRecentByUser.set(g.user_id, g.last_logged_date);
      }
      const totalMembers = members?.length ?? 0;
      const activeMembers = (members ?? []).filter((m) => {
        const mostRecent = mostRecentByUser.get(m.user_id);
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

      let highlight = '';
      try {
        const { data, error } = await supabase.functions.invoke(WEEKLY_RECAP_FUNCTION, { body: stats });
        if (!error && data?.highlight) highlight = data.highlight as string;
      } catch {
        // Numbers still render without the AI highlight line if the function isn't deployed yet.
      }

      return { ...stats, highlight, bestStreak, mostWateredFriendName, healthNow, healthWeekAgo };
    },
  });
}
