import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
  isAuthenticated: boolean;
  setAuth: (d: { accessToken: string; refreshToken: string; userId: string; email: string; name: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null, refreshToken: null, userId: null,
      email: null, name: null, isAuthenticated: false,
      setAuth: (d) => set({ ...d, isAuthenticated: true }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, userId: null, email: null, name: null, isAuthenticated: false }),
    }),
    { name: 'wag-admin-auth' }
  )
);
