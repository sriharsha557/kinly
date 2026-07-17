import * as Haptics from 'expo-haptics';
import { useLogGoalProgress } from './useGoals';
import { useLogEvent } from './useEvents';
import { useCreateAchievement } from './useAchievements';
import type { Goal } from '../types/models';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export interface Celebration {
  title: string;
  subtitle?: string;
}

// Shared by GoalsScreen's GoalCard and the Today screen's checklist - logging
// progress, detecting goal completion / streak milestones, and firing the
// matching event + achievement + haptic was previously duplicated logic.
export function useLogGoalWithCelebration(circleId: string, userId: string) {
  const logProgress = useLogGoalProgress();
  const logEvent = useLogEvent();
  const createAchievement = useCreateAchievement();

  async function logGoal(goal: Goal): Promise<Celebration | null> {
    const step = Math.max(1, Math.round(goal.target / 10));
    const wasComplete = goal.progress >= goal.target;
    const previousStreak = goal.streak_count;

    const updated = await logProgress.mutateAsync({ goalId: goal.id, circleId, increment: step });

    const justCompleted = !wasComplete && updated.progress >= updated.target;
    const hitMilestone = updated.streak_count > previousStreak && STREAK_MILESTONES.includes(updated.streak_count);

    if (justCompleted || hitMilestone) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    let celebration: Celebration | null = null;

    if (justCompleted) {
      await logEvent.mutateAsync({ circleId, userId, type: 'goal_completed', payload: { title: goal.title } });
      await createAchievement.mutateAsync({
        userId,
        circleId,
        type: 'goal_completed',
        title: `Completed "${goal.title}"`,
      });
      celebration = { title: `Completed "${goal.title}"! 🎉` };
    }
    if (hitMilestone) {
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
      celebration = { title: `${updated.streak_count}-day streak!`, subtitle: goal.title };
    }

    return celebration;
  }

  return { logGoal, isPending: logProgress.isPending };
}
