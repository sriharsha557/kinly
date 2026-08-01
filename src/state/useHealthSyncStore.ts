import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// null = never asked, which is what makes onboarding show the step exactly
// once. Same "never chose" marker the theme columns use.
export type HealthSyncDecision = 'connected' | 'declined' | null;

interface HealthSyncState {
  decision: HealthSyncDecision;
  // Onboarding waits for this before deciding whether to show the health
  // step, or a returning user would be asked again on every cold start
  // during the moment before AsyncStorage resolves.
  hasHydrated: boolean;
  setDecision: (decision: HealthSyncDecision) => void;
}

// Device-local rather than a profile column, unlike theme: Health Connect
// exists on one phone, and the same account on a second phone has a
// genuinely different answer. Syncing this across devices would be wrong.
export const useHealthSyncStore = create<HealthSyncState>()(
  persist(
    (set) => ({
      decision: null,
      hasHydrated: false,
      setDecision: (decision) => set({ decision }),
    }),
    {
      name: 'kinly-health-sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ decision: state.decision }),
      onRehydrateStorage: () => () => {
        useHealthSyncStore.setState({ hasHydrated: true });
      },
    },
  ),
);
