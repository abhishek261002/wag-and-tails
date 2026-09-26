import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useAuthStore } from '../src/store/auth.store';
import { usePushSetup } from '../src/lib/push';
import { colors } from '@wag/design-tokens';
import { configureMaps } from '@wag/ui-mobile';

// Ola Maps key for map tiles (a public, restricted key); without it maps fall back to OpenStreetMap tiles.
configureMaps({ apiKey: process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY || null });

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { loadFromStorage } = useAuthStore();
  usePushSetup();
  // Without these, every `fontFamily: 'Inter'` in this app silently fell
  // back to the system font — the partner app was the only surface never
  // loading the brand faces.
  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    PlusJakartaSans: PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="job/[id]" />
          <Stack.Screen name="walk/[id]" />
          <Stack.Screen name="navigate/[id]" options={{ gestureEnabled: false }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
