import { getNotifications } from './notifications-module';

// Foreground jobs are surfaced by jobs.tsx's own in-app popup modal, not
// the OS notification tray — this handler only governs notifications
// fired while backgrounded (see notifyIncomingJob below), so there's
// nothing further to suppress/show here.
let handlerSet = false;
function notifications() {
  const n = getNotifications();
  if (n && !handlerSet) {
    handlerSet = true;
    n.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return n;
}

// Wrapped defensively throughout: expo-notifications' web support is
// partial (no native permission prompt, limited local-notification
// support depending on browser), and this app is primarily exercised via
// `expo start --web` in local dev — a permission/schedule failure here
// must never crash the Jobs screen.
export async function configurePartnerNotifications(): Promise<void> {
  try {
    const Notifications = notifications();
    if (!Notifications) return;
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // No-op: platform doesn't support the prompt, or it was dismissed.
  }
}

export async function notifyIncomingJob(params: {
  title: string;
  petName: string;
  petBreed: string;
  addressLine: string;
  partnerPayout: number;
}): Promise<void> {
  try {
    const Notifications = notifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: `${params.petName} · ${params.petBreed} · ₹${params.partnerPayout} · ${params.addressLine}`,
        sound: true,
      },
      trigger: null, // fire immediately
    });
  } catch {
    // No-op: e.g. permission not granted, or unsupported on this platform.
  }
}
