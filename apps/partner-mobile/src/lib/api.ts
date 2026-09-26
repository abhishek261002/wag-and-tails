import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';
import Constants from 'expo-constants';
import { router } from 'expo-router';

// EXPO_PUBLIC_API_URL (set per EAS build profile) wins over app.json's extra.apiUrl.
function resolveBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
    'http://localhost:3001/api/v1';
  // While developing, a phone cannot reach this computer's "localhost": use the address Metro is served from.
  if (__DEV__ && /\/\/(localhost|127\.0\.0\.1)/.test(configured)) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return configured.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${host}`);
  }
  return configured;
}

const BASE_URL = resolveBaseUrl();

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
