import { router } from 'expo-router';

/**
 * Go back if there is a screen to go back to; otherwise land on the home tab. Plain router.back() logs a
 * "GO_BACK was not handled" error (and does nothing) after a reload, deep link or notification tap opens a
 * screen with no history behind it.
 */
export function goBack(fallback: string = '/(tabs)/jobs') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}

/**
 * Leave a finished flow and land on a tab with a clean history. A bare router.replace('/(tabs)/...') from a screen
 * above the tab bar stacks a second tab bar on the old one, and Android Back then shows the old screens again.
 */
export function goTab(tab: string) {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // nothing to dismiss
  }
  router.replace(tab as any);
}
