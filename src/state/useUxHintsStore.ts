import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UxHintsState {
  // Coined feature names ("Circle Garden", "Light Moments"...) each carry a
  // one-line plain-language subtitle the first time they're seen - see
  // ConceptHint. Dismissing one hides it everywhere it appears, forever,
  // keyed by concept (not by screen) so the same idea isn't re-explained
  // on a second surface after the reader already closed it once.
  dismissedHints: Record<string, true>;
  // The 5-step "here's how a circle works" walkthrough shown the first
  // time this device lands on Home with an active circle - once, like
  // hasSeenTutorial, but scoped to having actually joined/created a circle
  // rather than to first app open.
  hasSeenCircleGuide: boolean;
  dismissHint: (id: string) => void;
  setHasSeenCircleGuide: (seen: boolean) => void;
}

export const useUxHintsStore = create<UxHintsState>()(
  persist(
    (set) => ({
      dismissedHints: {},
      hasSeenCircleGuide: false,
      dismissHint: (id) => set((state) => ({ dismissedHints: { ...state.dismissedHints, [id]: true } })),
      setHasSeenCircleGuide: (hasSeenCircleGuide) => set({ hasSeenCircleGuide }),
    }),
    {
      name: 'kinly-ux-hints',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
