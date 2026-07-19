import webpush from 'web-push';

// Platform-aware push sender (spec §12.3). Phase 1 only sends web pushes;
// the Expo branch lands with Phase 2 (expo-server-sdk added then).

export interface PushPayload {
  title: string;
  body: string;
  data: { station_id: string; [key: string]: string };
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails('mailto:hello@chargeadvisor.com', publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPushNotification(
  token: string,
  platform: string,
  payload: PushPayload
): Promise<void> {
  if (platform === 'web') {
    if (!ensureVapid()) {
      throw new Error('VAPID keys not configured');
    }
    const subscription = JSON.parse(token); // Web Push subscription object
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return;
  }
  // ios / android — Expo Push Service, wired in Phase 2.
  throw new Error(`platform ${platform} not supported until Phase 2`);
}
