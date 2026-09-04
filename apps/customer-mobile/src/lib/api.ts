import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BASE_URL =
  (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
  'http://localhost:3001/api/v1';

export const wagApi = createWagApiClient({
  baseURL: BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokenRefreshed: async ({ accessToken, refreshToken }) => {
    const store = useAuthStore.getState();
    if (store.userId && store.role) {
      await store.setTokens(accessToken, refreshToken, store.userId, store.role);
    }
  },
  onAuthFailure: async () => {
    await useAuthStore.getState().clearTokens();
    router.replace('/(auth)/login');
  },
});
