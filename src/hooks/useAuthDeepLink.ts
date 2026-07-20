import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { completeEmailConfirmation, completePasswordRecovery } from '../lib/auth';
import { useAuthStore } from '../state/useAuthStore';

// Password reset and email confirmation links arrive by email, not through
// a browser session the app itself opened (unlike Google sign-in's
// WebBrowser.openAuthSessionAsync, which resolves the redirect directly) -
// so this needs a real global deep link listener, covering both a cold
// start (app opened by tapping the link) and a warm one (app already
// running in the background).
function handleUrl(url: string | null) {
  if (!url) return;
  if (url.includes('reset-password')) {
    completePasswordRecovery(url).catch(() => {
      // Swallow here - a stale/reused link just won't establish a session,
      // and ResetPasswordScreen never mounts (passwordRecoveryMode stays
      // false) so nothing else needs to react to the failure.
    });
  } else if (url.includes('auth-callback')) {
    completeEmailConfirmation(url).catch(() => {
      // Swallow - this URL is shared with Google sign-in, which already
      // resolves it directly, so this listener firing again with nothing
      // useful in it is expected, not an error worth surfacing.
    });
  } else if (url.includes('join')) {
    // kinly://join?code=ABC12345 - only works for someone who already has
    // the app installed (a plain custom-scheme link can't trigger a first
    // install), but for repeat invites/a second circle it saves retyping
    // an 8-char code from a WhatsApp message. CircleStep reads and clears
    // this on mount.
    const code = Linking.parse(url).queryParams?.code;
    if (typeof code === 'string' && code.length > 0) {
      useAuthStore.getState().setPendingInviteCode(code);
    }
  }
}

export function useAuthDeepLink() {
  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);
}
