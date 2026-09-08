import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BASE_URL =
  (Constants.expoConfig?.extra?.['apiUrl'] as string | undefined) ??
  'http://localhost:3001/api/v1';

// Locally-stored uploads (pet avatars, etc.) come back from the API as a
// relative "/uploads/..." path. Used directly as an <Image> uri, a relative
// path resolves against the Metro dev server's own origin (where no such
// file exists), not the API — so it must be resolved to the API's origin
// first. Absolute URLs (a real CDN/S3 url in prod) pass through unchanged.
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
