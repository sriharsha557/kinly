import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';

export function useBootstrapSession() {
  const setUser = useAuthStore((state) => state.setUser);
  const setActiveCircleId = useAuthStore((state) => state.setActiveCircleId);
  const setSessionLoading = useAuthStore((state) => state.setSessionLoading);

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

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFromSession(session?.user.id);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setUser, setActiveCircleId, setSessionLoading]);
}
