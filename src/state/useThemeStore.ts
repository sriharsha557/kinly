import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccentId, ThemeMode } from '../theme/colors';

interface ThemeState {
  accent: AccentId;
  mode: ThemeMode;
  // ThemeProvider waits for this before first paint so a returning user
  // never flashes default dusk/light on the way to their saved theme -
  // one fast AsyncStorage read, same pattern as useAuthStore.hasHydrated.
  hasHydrated: boolean;
  setAccent: (accent: AccentId) => void;
  setMode: (mode: ThemeMode) => void;
}

// Local cache is the instant source on launch; the profile row is the
// cross-device source of truth reconciled after login (see ThemeProvider).
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Dusk + light is the first impression: a calm, low-heat surface
      // rather than whatever the OS happens to be set to. Mode is a fixed
      // 'light' (not 'system') so a device in dark mode still opens light -
      // users who want dark pick it in onboarding or Profile.
      accent: 'dusk',
      mode: 'light',
      hasHydrated: false,
      setAccent: (accent) => set({ accent }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'kinly-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ accent: state.accent, mode: state.mode }),
      onRehydrateStorage: () => () => {
        useThemeStore.setState({ hasHydrated: true });
      },
    },
  ),
);
