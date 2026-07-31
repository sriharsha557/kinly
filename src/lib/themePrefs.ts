import { supabase } from './supabase';
import { useAuthStore } from '../state/useAuthStore';
import { useThemeStore } from '../state/useThemeStore';
import type { AccentId, ThemeMode } from '../theme/colors';

// The one write path for a theme choice, used by onboarding and Profile
// settings alike. Applies locally first (instant, offline-safe), then
// syncs the profile row in the background. The in-memory user copy is
// updated too so ThemeProvider's login reconciliation (profile -> store)
// doesn't immediately revert a fresh local choice to the stale value it
// still had from sign-in.
export async function setThemePrefs({ accent, mode }: { accent?: AccentId; mode?: ThemeMode }): Promise<void> {
  const themeStore = useThemeStore.getState();
  if (accent) themeStore.setAccent(accent);
  if (mode) themeStore.setMode(mode);

  const { user, setUser } = useAuthStore.getState();
  if (!user) return;
  setUser({
    ...user,
    theme_accent: accent ?? user.theme_accent,
    theme_mode: mode ?? user.theme_mode,
  });

  try {
    await supabase
      .from('profiles')
      .update({
        theme_accent: accent ?? user.theme_accent,
        theme_mode: mode ?? user.theme_mode,
      })
      .eq('id', user.id);
  } catch {
    // Offline is fine - the local store already applied, and the next
    // successful save syncs both fields again.
  }
}
