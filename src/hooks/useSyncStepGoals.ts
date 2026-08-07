import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSyncStepGoal } from './useGoals';
import { useGoalCheckins } from './useCheckins';
import { useLogEvent } from './useEvents';
import { useCreateAchievement } from './useAchievements';
import { STREAK_MILESTONES, type Celebration } from './useLogGoalWithCelebration';
import { getHealthConnectStatus, readTodaysSteps } from '../lib/healthConnect';
import { streak } from '../lib/showingUp';
import { toIsoDate } from '../lib/periods';
import { useHealthSyncStore } from '../state/useHealthSyncStore';
import type { Goal } from '../types/models';

// Runs app-wide (mounted from MainTabs, not any one screen) once on mount
// and again on every return to the foreground, when the device is connected
// to Health Connect and has at least one Health Connect-tracked goal: reads
// today's step count once and syncs every matching goal against it. Manual
// goals (the vast majority today) never touch this path - see
// sync_step_goal in migration 0033 for why step goals need daily-reset
// semantics that useLogGoalProgress doesn't have.
export function useSyncStepGoals(circleId: string | undefined, userId: string | undefined, goals: Goal[] | undefined) {
  const syncStepGoal = useSyncStepGoal();
  const logEvent = useLogEvent();
  const createAchievement = useCreateAchievement();
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const stepGoals = useMemo(() => (goals ?? []).filter((g) => g.goal_source === 'health_steps'), [goals]);
  const stepGoalsKey = stepGoals.map((g) => `${g.id}:${g.progress}:${g.streak_count}`).join(',');

  // The ledger a step goal's streak is actually counted from since migration
  // 0050. Held in a ref rather than added to the effect's dependency list:
  // this effect must fire on mount and on foreground, not every time the
  // check-ins query refetches, which would re-sync the device on every
  // invalidation this hook itself causes.
  const { data: checkinsByGoal } = useGoalCheckins(circleId);
  const checkinsRef = useRef<Record<string, string[]> | undefined>(undefined);
  useEffect(() => {
    checkinsRef.current = checkinsByGoal;
  }, [checkinsByGoal]);

  const isConnected = useHealthSyncStore((state) => state.decision === 'connected');

  useEffect(() => {
    // Gated on the connection: an unconnected device never touches the
    // native module at all. Permission is NOT requested here - that happens
    // only when the user taps Connect (useHealthSync), because a health
    // dialog appearing from a background sync is indistinguishable from a bug.
    if (!circleId || !userId || !isConnected || stepGoals.length === 0) return;
    let cancelled = false;

    // An arrow function assigned to a const, not a function declaration:
    // TypeScript only carries the circleId/userId non-null narrowing above
    // into a closure it can prove isn't reassigned before use.
    const sync = async () => {
      const status = await getHealthConnectStatus();
      if (status !== 'available' || cancelled) return;
      const steps = await readTodaysSteps();
      if (cancelled) return;

      for (const goal of stepGoals) {
        // Only health_steps goals reach here, and those always carry a real
        // device threshold - but target is nullable since migration 0049, so
        // the type needs the fallback even though it cannot fire.
        const wasComplete = goal.progress >= (goal.target ?? 0);
        // From the ledger, never goals.streak_count. Migration 0050's
        // sync_step_goal stopped touching that column - it inserts a
        // goal_checkins row instead - so `updated.streak_count >
        // previousStreak` became permanently false and step-goal users lost
        // every milestone celebration the moment 0050 was applied.
        const before = checkinsRef.current?.[goal.id] ?? [];
        const previousStreak = streak(goal, before, Date.now());

        const updated = await syncStepGoal.mutateAsync({ goalId: goal.id, circleId, steps });
        if (cancelled) return;

        const justCompleted = !wasComplete && updated.progress >= (updated.target ?? 0);
        // Today's row is added locally rather than refetched: the RPC has
        // just inserted it when the threshold was reached, and waiting for
        // the invalidated query to come back would put the celebration a
        // network round-trip after the moment it belongs to.
        const today = toIsoDate(new Date());
        const reachedToday = updated.target != null && updated.progress >= updated.target;
        const after = reachedToday && !before.includes(today) ? [...before, today] : before;
        const newStreak = streak(goal, after, Date.now());
        const hitMilestone = newStreak > previousStreak && STREAK_MILESTONES.includes(newStreak);
        if (!justCompleted && !hitMilestone) continue;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (justCompleted) {
          await logEvent.mutateAsync({ circleId, userId, type: 'goal_completed', payload: { title: goal.title } });
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'goal_completed',
            title: `Completed "${goal.title}"`,
          });
          setCelebration({ title: `Completed "${goal.title}"! 🎉` });
        } else {
          await logEvent.mutateAsync({
            circleId,
            userId,
            type: 'streak',
            payload: { title: goal.title, streak_count: newStreak },
          });
          // No unit: a streak is counted in the goal's own cadence periods
          // now, so "day" would be false for a step goal on anything but a
          // daily cadence.
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'streak',
            title: `${newStreak}-streak on "${goal.title}"`,
          });
          setCelebration({ title: `${newStreak}-streak!`, subtitle: goal.title });
        }
      }
    };

    // Once on mount, then once per return to the foreground - rather than on
    // every focus of one screen, which left the garden and Home's mission
    // list stale until the user happened to open Goals.
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, userId, isConnected, stepGoalsKey]);

  return { celebration, dismissCelebration: () => setCelebration(null) };
}
