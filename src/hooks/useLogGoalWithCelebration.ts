import * as Haptics from 'expo-haptics';
import { useLogGoalProgress } from './useGoals';
import { useLogEvent } from './useEvents';
import { useCreateAchievement } from './useAchievements';
import { supabase } from '../lib/supabase';
import { inviteMessage } from '../lib/share';
import type { Circle, Goal } from '../types/models';

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export interface Celebration {
  title: string;
  subtitle?: string;
  // Only set for the very first goal log a user ever makes - lets the modal
  // show an "invite friends" share button with real invite copy instead of
  // the generic achievement-share text.
  shareMessage?: string;
}

async function isFirstLogEver(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('last_logged_date', 'is', null);
  if (error) throw error;
  return (count ?? 0) === 0;
}

// Shared by GoalsScreen's GoalCard and the Today screen's checklist - logging
// progress, detecting goal completion / streak milestones, and firing the
// matching event + achievement + haptic was previously duplicated logic.
export function useLogGoalWithCelebration(circleId: string, userId: string, circle?: Circle) {
  const logProgress = useLogGoalProgress();
  const logEvent = useLogEvent();
  const createAchievement = useCreateAchievement();

  async function logGoal(goal: Goal, photoPath?: string): Promise<Celebration | null> {
    const step = Math.max(1, Math.round(goal.target / 10));
    const wasComplete = goal.progress >= goal.target;
    const previousStreak = goal.streak_count;

    // Only worth checking "is this the first log ever" when this specific
    // goal has never been logged either - cheap short-circuit that skips
    // the query entirely for the common case (repeat-logging an existing goal).
    const checkingFirstEver = goal.last_logged_date == null;
    const wasFirstEver = checkingFirstEver && (await isFirstLogEver(userId));

    const updated = await logProgress.mutateAsync({ goalId: goal.id, circleId, increment: step });

    const justCompleted = !wasComplete && updated.progress >= updated.target;
    const hitMilestone = updated.streak_count > previousStreak && STREAK_MILESTONES.includes(updated.streak_count);

    if (justCompleted || hitMilestone || wasFirstEver) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    let celebration: Celebration | null = null;
    // Tracks whether photoPath has already ridden along on a celebration
    // event, so a plain log doesn't also insert a second, redundant event
    // just for the photo.
    let photoAttached = false;

    if (justCompleted) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'goal_completed',
        payload: photoPath ? { title: goal.title, photo_path: photoPath } : { title: goal.title },
      });
      photoAttached = photoAttached || !!photoPath;
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
        payload:
          photoPath && !photoAttached
            ? { title: goal.title, streak_count: updated.streak_count, photo_path: photoPath }
            : { title: goal.title, streak_count: updated.streak_count },
      });
      photoAttached = photoAttached || !!photoPath;
      await createAchievement.mutateAsync({
        userId,
        circleId,
        type: 'streak',
        title: `${updated.streak_count}-day streak on "${goal.title}"`,
      });
      celebration = { title: `${updated.streak_count}-day streak!`, subtitle: goal.title };
    }
    // Deliberately checked last so it doesn't override a real completion/
    // streak celebration on the rare chance both land on the same log (e.g.
    // a 1-step goal completed on its very first log) - finishing a goal is
    // the bigger moment.
    if (wasFirstEver && !celebration) {
      celebration = {
        title: 'Your garden has started growing 🌱',
        subtitle: 'Gardens grow faster with friends',
        shareMessage: circle ? inviteMessage(circle.name, circle.invite_code) : undefined,
      };
    }

    // A plain log (no completion/streak milestone) never gets an events row
    // otherwise - without this, an attached photo would have nowhere to
    // surface in Circle Activity and the feature would be pointless.
    if (photoPath && !photoAttached) {
      await logEvent.mutateAsync({
        circleId,
        userId,
        type: 'progress_photo',
        payload: { title: goal.title, photo_path: photoPath },
      });
    }

    return celebration;
  }

  return { logGoal, isPending: logProgress.isPending };
}
