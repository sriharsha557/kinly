import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSyncStepGoal } from './useGoals';
import { useLogEvent } from './useEvents';
import { useCreateAchievement } from './useAchievements';
import { STREAK_MILESTONES, type Celebration } from './useLogGoalWithCelebration';
import { getHealthConnectStatus, readTodaysSteps, requestStepsReadPermission } from '../lib/healthConnect';
import type { Goal } from '../types/models';

// Runs whenever the Goals screen is focused with at least one Health
// Connect-tracked goal: reads today's step count once and syncs every
// matching goal against it. Manual goals (the vast majority today) never
// touch this path - see sync_step_goal in migration 0033 for why step
// goals need daily-reset semantics that useLogGoalProgress doesn't have.
export function useSyncStepGoals(circleId: string | undefined, userId: string | undefined, goals: Goal[] | undefined) {
  const syncStepGoal = useSyncStepGoal();
  const logEvent = useLogEvent();
  const createAchievement = useCreateAchievement();
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const stepGoals = useMemo(() => (goals ?? []).filter((g) => g.goal_source === 'health_steps'), [goals]);
  const stepGoalsKey = stepGoals.map((g) => `${g.id}:${g.progress}:${g.streak_count}`).join(',');

  useEffect(() => {
    if (!circleId || !userId || stepGoals.length === 0) return;
    let cancelled = false;

    (async () => {
      const status = await getHealthConnectStatus();
      if (status !== 'available' || cancelled) return;
      const granted = await requestStepsReadPermission();
      if (!granted || cancelled) return;
      const steps = await readTodaysSteps();
      if (cancelled) return;

      for (const goal of stepGoals) {
        const wasComplete = goal.progress >= goal.target;
        const previousStreak = goal.streak_count;
        const updated = await syncStepGoal.mutateAsync({ goalId: goal.id, circleId, steps });
        if (cancelled) return;

        const justCompleted = !wasComplete && updated.progress >= updated.target;
        const hitMilestone = updated.streak_count > previousStreak && STREAK_MILESTONES.includes(updated.streak_count);
        if (!justCompleted && !hitMilestone) continue;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (justCompleted) {
          await logEvent.mutateAsync({
            circleId,
            userId,
            type: 'goal_completed',
            payload: { title: goal.title },
          });
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'goal_completed',
            title: `Completed "${goal.title}"`,
          });
          setCelebration({ title: `Completed "${goal.title}"! 🎉` });
        } else if (hitMilestone) {
          await logEvent.mutateAsync({
            circleId,
            userId,
            type: 'streak',
            payload: { title: goal.title, streak_count: updated.streak_count },
          });
          await createAchievement.mutateAsync({
            userId,
            circleId,
            type: 'streak',
            title: `${updated.streak_count}-day streak on "${goal.title}"`,
          });
          setCelebration({ title: `${updated.streak_count}-day streak!`, subtitle: goal.title });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, userId, stepGoalsKey]);

  return { celebration, dismissCelebration: () => setCelebration(null) };
}
