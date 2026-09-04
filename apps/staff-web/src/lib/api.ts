import { createWagApiClient } from '@wag/api-client';
import { useAuthStore } from '../store/auth.store';

const BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001/api/v1';

export const wagApi = createWagApiClient({
  baseURL: BASE_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokenRefreshed: ({ accessToken, refreshToken }) => {
    const s = useAuthStore.getState();
    useAuthStore.getState().setAuth({
      accessToken,
      refreshToken,
      userId: s.userId ?? '',
      role: s.role ?? '',
      email: s.email ?? '',
      name: s.name ?? '',
    });
  },
  onAuthFailure: () => {
    useAuthStore.getState().clearAuth();
    window.location.href = '/login';
  },
});
