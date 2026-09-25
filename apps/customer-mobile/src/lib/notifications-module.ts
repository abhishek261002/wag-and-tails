import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * expo-notifications throws as soon as it is imported inside Expo Go on Android (remote push was removed from
 * Expo Go in SDK 53), which would take down the whole route tree. So it is loaded on demand, and not at all
 * in that environment. In a development or production build, and on iOS and web, it loads normally.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS === 'android' && inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    cached = require('expo-notifications') as NotificationsModule;
  } catch (err) {
    console.warn('expo-notifications unavailable:', (err as Error)?.message);
    cached = null;
  }
  return cached;
}
