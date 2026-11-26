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

/**
 * Drop every screen above the tab bar (the booking wizard steps, checkout, ...). Without this a finished booking
 * keeps its wizard in the history, so Android Back from Home walks back into a booking that was already placed.
 */
export function dismissFlow() {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // nothing to dismiss
  }
}

/** Leave a finished flow and land on the home tab with a clean history. */
export function goHome() {
  dismissFlow();
  router.replace('/(tabs)/home' as any);
}
