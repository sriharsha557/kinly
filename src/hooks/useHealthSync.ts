import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getHealthConnectStatus,
  openHealthConnectSettings,
  requestStepsReadPermission,
  type HealthConnectStatus,
} from '../lib/healthConnect';
import { useGoals, useSetGoalSource } from './useGoals';
import { useHealthSyncStore, type HealthSyncDecision } from '../state/useHealthSyncStore';
import { isStepGoal } from '../lib/stepGoal';
import { useAuthStore } from '../state/useAuthStore';

// The single write path for the health-sync connection, used by onboarding
// and Profile settings alike - the same shape as themePrefs.ts, which is the
// established pattern for "one place that changes a preference".
//
// Permission is requested here and nowhere else. It used to be requested
// from inside useSyncStepGoals' effect, which made Android's health dialog
// appear when the user opened the Goals tab, unprompted and unexplained.
export function useHealthSync(circleId?: string) {
  const decision = useHealthSyncStore((state) => state.decision);
  const setDecision = useHealthSyncStore((state) => state.setDecision);
  const userId = useAuthStore((state) => state.user?.id);
  const { data: goals } = useGoals(circleId);
  const setGoalSource = useSetGoalSource();
  const [isBusy, setIsBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Cached rather than re-read on every render: getSdkStatus touches the
  // native module, and the answer only changes if the user installs Health
  // Connect while the app is running.
  const { data: status = 'checking' } = useQuery({
    queryKey: ['healthConnectStatus'],
    queryFn: getHealthConnectStatus,
    staleTime: 5 * 60 * 1000,
  });

  // Both conditions matter: a device that connected and later had Health
  // Connect uninstalled reports 'connected' but cannot sync, and a switch
  // showing on while nothing happens is worse than one showing off.
  const isConnected = decision === 'connected' && status === 'available';

  const connect = useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    setPermissionDenied(false);
    try {
      const granted = await requestStepsReadPermission();
      if (!granted) {
        setPermissionDenied(true);
        return false;
      }
      setDecision('connected');

      // Detection at creation time alone would break the promise for the
      // commonest case: someone creates "Walk 8,000 steps daily" on day one,
      // finds this a week later, connects - and that goal still needs
      // logging by hand because it was created 'manual'. One pass over what
      // they already have fixes that. Runs on connect only, never on start.
      if (circleId && userId) {
        const convertible = (goals ?? []).filter(
          (goal) =>
            goal.user_id === userId &&
            goal.goal_source === 'manual' &&
            isStepGoal(goal.title, goal.target),
        );
        for (const goal of convertible) {
          await setGoalSource.mutateAsync({ goalId: goal.id, circleId, source: 'health_steps' });
        }
      }
      return true;
    } finally {
      setIsBusy(false);
    }
  }, [circleId, userId, goals, setDecision, setGoalSource]);

  // Deliberately does NOT convert goals back to 'manual'. That would rewrite
  // the user's data in response to a permission change, and would discard
  // any per-goal undos they had already made. The sync hook is gated on the
  // connection, so those goals simply stop updating until they reconnect.
  const disconnect = useCallback(() => {
    setDecision('declined');
    setPermissionDenied(false);
  }, [setDecision]);

  const decline = useCallback(() => setDecision('declined'), [setDecision]);

  return {
    status: status as HealthConnectStatus | 'checking',
    decision: decision as HealthSyncDecision,
    isConnected,
    permissionDenied,
    isBusy,
    connect,
    decline,
    disconnect,
    openSettings: openHealthConnectSettings,
  };
}
