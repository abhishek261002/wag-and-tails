import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (access, refresh, userId, role) => {
    await Promise.all([
      storage.setItem(ACCESS_KEY, access),
      storage.setItem(REFRESH_KEY, refresh),
      storage.setItem(USER_KEY, userId),
      storage.setItem(ROLE_KEY, role),
    ]);
    set({ accessToken: access, refreshToken: refresh, userId, role, isAuthenticated: true });
  },

  clearTokens: async () => {
    await Promise.all([
      storage.deleteItem(ACCESS_KEY),
      storage.deleteItem(REFRESH_KEY),
      storage.deleteItem(USER_KEY),
      storage.deleteItem(ROLE_KEY),
    ]);
    set({ accessToken: null, refreshToken: null, userId: null, role: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [access, refresh, userId, role] = await Promise.all([
        storage.getItem(ACCESS_KEY),
        storage.getItem(REFRESH_KEY),
        storage.getItem(USER_KEY),
        storage.getItem(ROLE_KEY),
      ]);
      if (access && refresh && userId && role) {
        set({ accessToken: access, refreshToken: refresh, userId, role, isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));