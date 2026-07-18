import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { completePasswordRecovery } from '../lib/auth';

// Password reset links arrive by email, not through a browser session the
// app itself opened (unlike Google sign-in's WebBrowser.openAuthSessionAsync,
// which resolves the redirect directly) - so this needs a real global deep
// link listener, covering both a cold start (app opened by tapping the link)
// and a warm one (app already running in the background).
function handleUrl(url: string | null) {
  if (url && url.includes('reset-password')) {
    completePasswordRecovery(url).catch(() => {
      // Swallow here - a stale/reused link just won't establish a session,
      // and ResetPasswordScreen never mounts (passwordRecoveryMode stays
      // false) so nothing else needs to react to the failure.
    });
  }
}

export function useAuthDeepLink() {
  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);
}
