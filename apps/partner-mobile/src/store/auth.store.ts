import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (access: string, refresh: string, userId: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

const ACCESS_KEY = 'wag_partner_access';
const REFRESH_KEY = 'wag_partner_refresh';
const USER_KEY = 'wag_partner_uid';

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (access, refresh, userId) => {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    await SecureStore.setItemAsync(USER_KEY, userId);
    set({ accessToken: access, refreshToken: refresh, userId, isAuthenticated: true });
  },

  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, userId: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [access, refresh, userId] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (access && refresh && userId) {
        set({ accessToken: access, refreshToken: refresh, userId, isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
