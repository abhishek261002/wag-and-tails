import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/auth.store';
import { wagApi } from '../src/lib/api';
import { colors } from '@wag/design-tokens';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending'>('checking');

  useEffect(() => {
    if (!isAuthenticated) return;
    // A returning partner whose application is still pending should land
    // back on the pending-approval screen, not the main tabs — status only
    // flips once staff approves them (see (auth)/pending-approval.tsx).
    wagApi.partner.getProfile()
      .then((p: any) => setStatus(p?.status === 'approved' ? 'approved' : 'pending'))
      .catch(() => setStatus('approved')); // fail open rather than stranding a logged-in user
  }, [isAuthenticated]);

  if (isLoading || (isAuthenticated && status === 'checking')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.brandBrown} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  return status === 'pending'
    ? <Redirect href="/(auth)/pending-approval" />
    : <Redirect href="/(tabs)/jobs" />;
}
