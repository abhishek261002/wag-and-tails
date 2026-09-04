import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string, userId: string, role: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

const ACCESS_KEY = 'wag_access_token';
const REFRESH_KEY = 'wag_refresh_token';
const USER_KEY = 'wag_user_id';
const ROLE_KEY = 'wag_role';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (access, refresh, userId, role) => {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    await SecureStore.setItemAsync(USER_KEY, userId);
    await SecureStore.setItemAsync(ROLE_KEY, role);
    set({ accessToken: access, refreshToken: refresh, userId, role, isAuthenticated: true });
  },

  clearTokens: async () => {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(ROLE_KEY);
    set({ accessToken: null, refreshToken: null, userId: null, role: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [access, refresh, userId, role] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
        SecureStore.getItemAsync(ROLE_KEY),
      ]);
      if (access && refresh && userId && role) {
        set({ accessToken: access, refreshToken: refresh, userId, role, isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
