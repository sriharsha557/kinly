import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { resolveTheme, type Theme } from './colors';
import { useThemeStore } from '../state/useThemeStore';
import { useAuthStore } from '../state/useAuthStore';

export type { Theme } from './colors';

const ThemeContext = createContext<Theme>(resolveTheme('ember', 'light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  // null while the OS hasn't reported (rare, first frame) - treat as light.
  // Re-renders live when the user flips the system theme, which is what
  // makes mode = "system" follow along without a restart.
  const systemScheme = useColorScheme();
  const accent = useThemeStore((state) => state.accent);
  const mode = useThemeStore((state) => state.mode);
  const hasHydrated = useThemeStore((state) => state.hasHydrated);
  const setAccent = useThemeStore((state) => state.setAccent);
  const setMode = useThemeStore((state) => state.setMode);
  const user = useAuthStore((state) => state.user);

  // Cross-device reconciliation: the profile row wins over the local cache
  // once a signed-in profile arrives with a saved preference (null means
  // "never chose" and leaves the local value alone). setThemePrefs updates
  // the in-memory user alongside the store, so a fresh local choice is
  // never clobbered by the stale copy loaded at sign-in.
  useEffect(() => {
    if (user?.theme_accent && user.theme_accent !== accent) setAccent(user.theme_accent);
    if (user?.theme_mode && user.theme_mode !== mode) setMode(user.theme_mode);
    // Deliberately keyed to the profile values only - reacting to local
    // accent/mode here would turn every local change into a revert fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme_accent, user?.theme_mode]);

  const scheme = mode === 'system' ? (systemScheme ?? 'light') : mode;
  const theme = useMemo(() => resolveTheme(accent, scheme), [accent, scheme]);

  // At most one blank frame while AsyncStorage answers - cheaper than
  // flashing the default theme at a user who picked another one.
  if (!hasHydrated) return null;

  return (
    <ThemeContext.Provider value={theme}>
      {children}
      {/* Status bar text must contrast the app's own background, not the
          OS theme - so it derives from the resolved scheme, not "auto". */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
