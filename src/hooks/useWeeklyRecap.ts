import { useMemo } from 'react';
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

  // The server fetches, and nothing else. Anything derived from `activity`
  // is computed outside this query: the queryKey names nothing that changes
  // when the goals and check-ins queries resolve, so TanStack never re-runs
  // the function - on a cold mount `activity` is empty, and this card
  // cached "0% circle health" and "A quiet week. Next one is yours." for a
  // circle the garden was drawing as thriving.
  const query = useQuery({
    queryKey: ['weeklyRecap', circleId],
    enabled: !!circleId,
    queryFn: async () => {
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
      const memberIds = (members ?? []).map((m) => m.user_id as string);

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

      return {
        goalsCompleted,
        streakMilestones,
        nudgesSent: nudgesSent ?? 0,
        asksPosted,
        mostWateredFriendName,
        healthWeekAgo,
        memberIds,
      };
    },
  });

  const derived = useMemo(() => {
    // Best streak across the circle, from the check-in ledger rather than
    // goals.streak_count, which the ledger never writes. This is a max
    // across goals in different cadences (a 5-period daily streak and a
    // 2-period monthly streak are not the same unit) - accepted, which is
    // why no copy states "days".
    let bestStreak = 0;
    for (const memberActivity of activity.values()) {
      bestStreak = Math.max(bestStreak, memberActivity.bestStreak);
    }

    // Most recent check-in per member, from the same activity map -
    // replaces the old goals.last_logged_date read, which the ledger
    // never writes.
    const memberIds = query.data?.memberIds ?? [];
    const activeMembers = memberIds.filter((id) => {
      const mostRecent = activity.get(id)?.lastCheckinDate;
      if (!mostRecent) return false;
      const daysSince = Math.floor((Date.now() - new Date(mostRecent).getTime()) / 86_400_000);
      return daysSince <= 3;
    }).length;
    const healthNow = memberIds.length > 0 ? Math.round((activeMembers / memberIds.length) * 100) : 0;

    return { bestStreak, healthNow };
  }, [activity, query.data]);

  const data: WeeklyRecap | undefined = useMemo(() => {
    if (!query.data) return undefined;
    const { memberIds: _memberIds, ...stats } = query.data;
    // Assembled locally from the numbers above, rather than sent to an API
    // to be phrased. No network call, so nothing here can fail and no
    // tolerate-failure path is needed. It lives out here with the numbers
    // it reads: phrased inside the query it would have quoted the empty
    // activity map and then never been re-phrased.
    const highlight = weeklyHighlight({ ...stats, ...derived });
    return { ...stats, ...derived, highlight };
  }, [query.data, derived]);

  return { ...query, data };
}
