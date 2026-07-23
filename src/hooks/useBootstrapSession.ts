import { useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { consumeExpectedSignOut, fetchProfile } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';

export function useBootstrapSession() {
  const setUser = useAuthStore((state) => state.setUser);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const setSessionLoading = useAuthStore((state) => state.setSessionLoading);
  const setPasswordRecoveryMode = useAuthStore((state) => state.setPasswordRecoveryMode);

  useEffect(() => {
    let isMounted = true;

    async function loadFromSession(userId: string | undefined) {
      if (!userId) {
        if (isMounted) {
          setUser(null);
          setActiveCircleId(null);
        }
        return;
      }
      try {
        const profile = await fetchProfile(userId);
        if (isMounted) setUser(profile);
      } catch {
        if (isMounted) setUser(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      loadFromSession(data.session?.user.id).finally(() => {
        if (isMounted) setSessionLoading(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryMode(true);
      if (event === 'SIGNED_OUT' && !session) {
        const wasExpected = consumeExpectedSignOut();
        const hadUser = useAuthStore.getState().user !== null;
        if (!wasExpected && hadUser) {
          Alert.alert('Session expired', "You've been signed out - please sign in again.");
        }
      }
      loadFromSession(session?.user.id);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setUser, setActiveCircleId, setSessionLoading, setPasswordRecoveryMode]);
}
