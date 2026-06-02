// lib/push-register.js
// Shared push subscription sync utility.
//
// Call syncPushSubscription(userId) any time you want to ensure the DB
// has the current valid subscription for this device. Safe to call on
// every login — it's a silent upsert and does nothing if permission
// hasn't been granted or the browser doesn't support push.

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export { urlBase64ToUint8Array };

/**
 * Ensures the DB has a valid push subscription for this user+device.
 *
 * Handles three cases automatically:
 *   1. Subscription exists in browser → upsert it (keeps DB in sync)
 *   2. No subscription but permission granted → re-subscribe (covers PWA
 *      reinstall on iOS, browser data clear, subscription expiry)
 *   3. Permission not granted → no-op
 *
 * Always safe to call silently on startup.
 */
export async function syncPushSubscription(userId) {
  if (!userId) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      // Permission was granted but subscription is gone (PWA reinstall, data clear, expiry).
      // Re-subscribe automatically so the user keeps receiving notifications
      // without having to go back into settings.
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Upsert — safe to call even if already stored; keeps endpoint fresh
    await fetch('/api/push-subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, subscription: sub.toJSON() }),
    }).catch(() => {});
  } catch {
    // Best-effort — never throw, never block the app
  }
}
