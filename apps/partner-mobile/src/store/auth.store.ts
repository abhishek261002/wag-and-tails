import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  userId: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (access, refresh, userId) => {
    await Promise.all([
      storage.setItem(ACCESS_KEY, access),
      storage.setItem(REFRESH_KEY, refresh),
      storage.setItem(USER_KEY, userId),
    ]);
    set({ accessToken: access, refreshToken: refresh, userId, isAuthenticated: true });
  },

  clearTokens: async () => {
    await Promise.all([
      storage.deleteItem(ACCESS_KEY),
      storage.deleteItem(REFRESH_KEY),
      storage.deleteItem(USER_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, userId: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [access, refresh, userId] = await Promise.all([
        storage.getItem(ACCESS_KEY),
        storage.getItem(REFRESH_KEY),
        storage.getItem(USER_KEY),
      ]);
      if (access && refresh && userId) {
        set({ accessToken: access, refreshToken: refresh, userId, isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));