import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BASE_URL =
  (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
  'http://localhost:3001/api/v1';

// Uploads come back as a relative "/uploads/..." path; resolve against the API origin for <Image>.
const API_ORIGIN = BASE_URL.replace(/\/api\/v1\/?$/, '');
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const wagApi = createWagApiClient({
  baseURL: BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokenRefreshed: async ({ accessToken, refreshToken }) => {
    const { userId, setTokens } = useAuthStore.getState();
    if (userId) await setTokens(accessToken, refreshToken, userId);
  },
  onAuthFailure: async () => {
    await useAuthStore.getState().clearTokens();
    router.replace('/(auth)/login');
  },
});
