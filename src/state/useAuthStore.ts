import { create } from 'zustand';
import type { User } from '../types/models';

interface AuthState {
  user: User | null;
  activeCircleId: string | null;
  sessionLoading: boolean;
  setUser: (user: User | null) => void;
  setActiveCircleId: (circleId: string | null) => void;
  setSessionLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeCircleId: null,
  sessionLoading: true,
  setUser: (user) => set({ user }),
  setActiveCircleId: (activeCircleId) => set({ activeCircleId }),
  setSessionLoading: (sessionLoading) => set({ sessionLoading }),
}));
