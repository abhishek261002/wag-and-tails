import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001/api/v1';

// Locally-stored uploads come back from the API as a relative "/uploads/..."
// path, which resolves against this app's own origin — not the API's —
// when used directly as an <img> src.
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
  onTokenRefreshed: ({ accessToken, refreshToken }) => {
    const s = useAuthStore.getState();
    s.setAuth({ accessToken, refreshToken, userId: s.userId ?? '', email: s.email ?? '', name: s.name ?? '' });
  },
  onAuthFailure: () => { useAuthStore.getState().clearAuth(); window.location.href = '/login'; },
});
