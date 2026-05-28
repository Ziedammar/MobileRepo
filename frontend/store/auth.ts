import { create } from 'zustand';
import type { AuthUser } from '@/src/types';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  setAuth: (token: string, refreshToken: string | null, user: AuthUser) => void;
  clearAuth: () => void;
  setUser: (user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isLoading: false,
  setAuth: (token, refreshToken, user) =>
    set({ token, refreshToken, user }),
  clearAuth: () => set({ token: null, refreshToken: null, user: null }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
