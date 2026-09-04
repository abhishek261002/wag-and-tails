import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: string | null;
  email: string | null;
  name: string | null;
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; refreshToken: string; userId: string; role: string; email: string; name: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      role: null,
      email: null,
      name: null,
      isAuthenticated: false,
      setAuth: (data) => set({ ...data, isAuthenticated: true }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, userId: null, role: null, email: null, name: null, isAuthenticated: false }),
    }),
    { name: 'wag-staff-auth' }
  )
);
