import { create } from 'zustand';
import type { User } from '../types/models';

interface AuthState {
  user: User | null;
  activeCircleId: string | null;
  setUser: (user: User | null) => void;
  setActiveCircleId: (circleId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  activeCircleId: null,
  setUser: (user) => set({ user }),
  setActiveCircleId: (activeCircleId) => set({ activeCircleId }),
}));
