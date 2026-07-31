import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccentId, ThemeMode } from '../theme/colors';

interface ThemeState {
  accent: AccentId;
  mode: ThemeMode;
  // ThemeProvider waits for this before first paint so a returning user
  // never flashes default ember/light on the way to their saved theme -
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
      accent: 'ember',
      mode: 'system',
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
