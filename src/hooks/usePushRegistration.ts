import { useEffect } from 'react';
import { registerForPushNotifications } from '../lib/pushNotifications';

export function usePushRegistration(userId: string | undefined) {
  useEffect(() => {
    if (userId) {
      registerForPushNotifications(userId);
    }
  }, [userId]);
}
