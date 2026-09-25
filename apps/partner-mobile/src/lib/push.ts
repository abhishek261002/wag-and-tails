import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { wagApi } from './api';
import { getNotifications } from './notifications-module';
import { useAuthStore } from '../store/auth.store';

let registeredToken: string | null = null;

// Foreground notifications are shown as a banner too; the inbox is the record.
let handlerSet = false;
function ensureHandler() {
  const Notifications = getNotifications();
  if (handlerSet || !Notifications) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Asks for permission, gets this device's Expo push token and gives it to the API. Every step is
 * best-effort: simulators, web, denied permission and a missing EAS project id simply mean no push, never
 * a crash. Remote push needs a development or production build (not Expo Go on Android).
 */
export async function registerPush(): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (Platform.OS === 'web' || !Notifications) return null;
    ensureHandler();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Wag & Tails',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token === registeredToken) return token;
    await wagApi.auth.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
    return token;
  } catch (err) {
    console.warn('push registration skipped:', (err as Error)?.message);
    return null;
  }
}

/** Called on sign-out so this device stops receiving the previous account's notifications. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await wagApi.client.delete('/auth/push-token', { data: { token } });
  } catch {
    // Signed out already or offline; the API also moves the token when someone else signs in on this device.
  }
}

/** Where a tapped notification should lead. */
export function openNotification(data: Record<string, any> | undefined) {
  const type = String(data?.type ?? '');
  try {
    if (type.startsWith('commission')) {
      router.push('/(tabs)/earnings' as any);
    } else if (type === 'booking.soon' && data?.bookingId) {
      router.push({ pathname: data.bookingType === 'walking' ? '/walk/[id]' : '/job/[id]', params: { id: String(data.bookingId) } } as any);
    } else {
      // New or direct job requests, walk requests and everything else: the jobs list has the actions.
      router.push('/(tabs)/jobs' as any);
    }
  } catch {
    // Navigation not ready yet (cold start).
  }
}

/** Mount once in the root layout: registers the device after sign-in and routes taps. */
export function usePushSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    ensureHandler();
    registerPush();
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as Record<string, any> | undefined;
      openNotification(data);
      const id = data?.notificationId;
      if (id) wagApi.client.patch(`/notifications/${id}/read`, {}).catch(() => {});
    });
    // App opened by tapping a notification while it was closed.
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => {
        if (resp) openNotification(resp.notification.request.content.data as Record<string, any>);
      })
      .catch(() => {});
    return () => sub.remove();
  }, [isAuthenticated]);
}
