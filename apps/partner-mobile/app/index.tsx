import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/auth.store';
import { colors } from '@wag/design-tokens';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.brandBrown} />
      </View>
    );
  }

  return isAuthenticated
    ? <Redirect href="/(tabs)/jobs" />
    : <Redirect href="/(auth)/login" />;
}
