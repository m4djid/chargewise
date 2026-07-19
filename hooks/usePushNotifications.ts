'use client';

import { useCallback, useEffect, useState } from 'react';

// Web push registration — spec §6.6. Only prompts when permission is still
// 'default'; never re-prompts after a denial.

// Standard helper: VAPID public key (base64url) → Uint8Array.
// Explicitly backed by an ArrayBuffer so it satisfies BufferSource under
// TypeScript 5.7+'s stricter typed-array generics.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPermission(pushSupported() ? Notification.permission : 'unsupported');
  }, []);

  const subscribe = useCallback(async () => {
    if (!pushSupported()) return;
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    setPermission(perm);
    if (perm !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: JSON.stringify(subscription), platform: 'web' }),
      });
    } catch {
      // Subscription failed (SW error, push service unreachable) — non-fatal.
    }
  }, []);

  return { permission, subscribe };
}
