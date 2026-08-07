import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { circlePrompt, type CircleCategory } from '../lib/circlePrompts';
import { streak, type Cadence } from '../lib/showingUp';
import { toIsoDate } from '../lib/periods';
import type { AreaKey } from '../types/models';

export interface CircleAIInsight {
  strongest: CircleCategory;
  weakest: CircleCategory | null;
  message: string;
  suggestedChallenge: string | null;
}

// circlePrompts.ts only has strength/nudge copy and challenge lists for the
// five old pillars. mind, career and community are real Areas (migration
// 0046) but have no entry in CHALLENGES yet - writing that product voice is
// its own piece of work (the taxonomy plan). Goals in those three Areas are
// excluded from strongest/weakest below rather than mapped to a made-up
// category, because suggesting nothing beats suggesting a challenge the
// catalogue cannot describe.
const AREA_KEY_TO_CATEGORY: Partial<Record<AreaKey, CircleCategory>> = {
  health: 'health',
  finance: 'wealth',
  creativity: 'ideas',
  learning: 'learning',
  family: 'relationships',
};

const CHECKIN_WINDOW_DAYS = 120;

// Weeks since the epoch. Only its stability matters, not its absolute value:
// it holds steady for seven days and then moves on, which is exactly what
// keeps the suggested challenge from changing on every render.
function isoWeek(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}

interface AreaGoalRow extends Cadence {
  id: string;
  areas: { key: AreaKey } | null;
}

export function useCircleAI(circleId: string | undefined) {
  return useQuery({
    queryKey: ['circleAI', circleId],
    enabled: !!circleId,
    queryFn: async (): Promise<CircleAIInsight | null> => {
      // Same filter useGoals uses: status='active' from a member's own
      // action must disappear, but migration 0047's status='ended' goals
      // stay visible until useGoals.ts's own blast-radius decision lands -
      // this hook must not narrow ahead of that.
      const { data: goals, error } = await supabase
        .from('goals')
        .select('id, target_type, target_count, target_weekdays, areas(key)')
        .eq('circle_id', circleId as string)
        .or('status.eq.active,ended_reason.eq.migration')
        .not('area_id', 'is', null);
      if (error) throw error;
      if (!goals || goals.length === 0) return null;

      const rows = goals as unknown as AreaGoalRow[];

      const since = new Date();
      since.setDate(since.getDate() - CHECKIN_WINDOW_DAYS);
      const { data: checkins, error: checkinsError } = await supabase
        .from('goal_checkins')
        .select('goal_id, checkin_date')
        .in('goal_id', rows.map((g) => g.id))
        .gte('checkin_date', toIsoDate(since));
      if (checkinsError) throw checkinsError;

      const checkinsByGoal: Record<string, string[]> = {};
      for (const row of (checkins ?? []) as { goal_id: string; checkin_date: string }[]) {
        (checkinsByGoal[row.goal_id] ??= [] as string[]).push(row.checkin_date.slice(0, 10));
      }

      const now = Date.now();
      const totals = new Map<CircleCategory, number>();
      for (const g of rows) {
        const category = g.areas ? AREA_KEY_TO_CATEGORY[g.areas.key] : undefined;
        if (!category) continue;
        const goalStreak = streak(g, checkinsByGoal[g.id] ?? [], now);
        totals.set(category, (totals.get(category) ?? 0) + goalStreak);
      }
      if (totals.size === 0) return null;

      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const strongest = sorted[0][0];
      const weakestRaw = sorted[sorted.length - 1][0];
      const weakest = strongest === weakestRaw ? null : weakestRaw;

      // Curated copy chosen from the same category totals an API used to be
      // sent. The week seed keeps one suggestion in place for seven days.
      const { message, suggestedChallenge } = circlePrompt(strongest, weakest, isoWeek(new Date()));

      return { strongest, weakest, message, suggestedChallenge };
    },
  });
}
