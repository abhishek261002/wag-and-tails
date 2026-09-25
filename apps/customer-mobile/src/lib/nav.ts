import { router } from 'expo-router';

/**
 * Go back if there is a screen to go back to; otherwise land on the home tab. Plain router.back() logs a
 * "GO_BACK was not handled" error (and does nothing) after a reload, deep link or notification tap opens a
 * screen with no history behind it.
 */
export function goBack(fallback: string = '/(tabs)/home') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}
