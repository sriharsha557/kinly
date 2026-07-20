import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types/models';

interface AuthState {
  user: User | null;
  activeCircleId: string | null;
  sessionLoading: boolean;
  passwordRecoveryMode: boolean;
  hasHydrated: boolean;
  // Set by a kinly://join?code=... deep link (see useAuthDeepLink.ts) so
  // OnboardingScreen's CircleStep can pre-fill the invite code field
  // instead of making someone who already has the app retype an 8-char
  // code by hand from a WhatsApp message. Not persisted - a one-shot
  // handoff, consumed and cleared by CircleStep on read.
  pendingInviteCode: string | null;
  setUser: (user: User | null) => void;
  setActiveCircleId: (circleId: string | null) => void;
  setSessionLoading: (loading: boolean) => void;
  setPasswordRecoveryMode: (recovering: boolean) => void;
  setPendingInviteCode: (code: string | null) => void;
}

// activeCircleId used to live in memory only, so it reset to null on every
// cold start - RootNavigator would then fall through to OnboardingScreen's
// CircleStep, whose "no active circle yet" fallback picks circles[0] (the
// oldest circle, by insertion order), silently overriding whatever circle
// the user was actually last viewing. Persisting just this one field fixes
// that; user/session stay unpersisted since they're already re-derived
// from the live Supabase session on every launch via useBootstrapSession,
// and persisting them too would risk showing stale data instead.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeCircleId: null,
      sessionLoading: true,
      passwordRecoveryMode: false,
      hasHydrated: false,
      pendingInviteCode: null,
      setUser: (user) => set({ user }),
      setActiveCircleId: (activeCircleId) => set({ activeCircleId }),
      setSessionLoading: (sessionLoading) => set({ sessionLoading }),
      setPasswordRecoveryMode: (passwordRecoveryMode) => set({ passwordRecoveryMode }),
      setPendingInviteCode: (pendingInviteCode) => set({ pendingInviteCode }),
    }),
    {
      name: 'kinly-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ activeCircleId: state.activeCircleId }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
