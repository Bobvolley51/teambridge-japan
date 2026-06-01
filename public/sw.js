// public/sw.js — TeamBridge Service Worker
// Handles push notifications and basic offline caching

const CACHE = 'tb-v1';

// ── Install: cache shell assets ──────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// ── Push: show notification ──────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: 'TeamBridge', body: e.data.text() }; }

  const { title = 'TeamBridge', body = '', url = '/', icon = '/icon-192.png', badge = '/icon-192.png', tag, badgeCount } = payload;

  const tasks = [
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag: tag || 'tb-default',
      renotify: true,
      data: { url },
    }),
  ];

  // Set home-screen badge — try multiple API paths (Safari SW vs Chrome SW)
  if (badgeCount != null) {
    const setBadge = async () => {
      try {
        // Standard: navigator.setAppBadge (Chrome, Edge, Android)
        if ('setAppBadge' in navigator) { await navigator.setAppBadge(badgeCount); return; }
        // Safari service worker global scope
        if ('setAppBadge' in self) { await self.setAppBadge(badgeCount); return; }
        if (self.navigator && 'setAppBadge' in self.navigator) { await self.navigator.setAppBadge(badgeCount); return; }
      } catch (_) {}
      // Fallback: notify any open app windows to set the badge
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of allClients) c.postMessage({ type: 'SET_BADGE', count: badgeCount });
    };
    tasks.push(setBadge());
  }

  e.waitUntil(Promise.all(tasks));
});

// ── Push subscription renewal (iOS APNs tokens expire silently) ─────────
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription.options)
      .then(async (newSub) => {
        // Find the userId stored in IndexedDB or send via message to client
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // Ask the active client to re-register the new subscription
        for (const client of clients) {
          client.postMessage({ type: 'PUSH_RESUBSCRIBE', subscription: newSub.toJSON() });
        }
      })
      .catch(() => {})
  );
});

// ── Notification click: focus or open app ───────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // Clear badge when user taps the notification
  if ('clearAppBadge' in self.navigator) self.navigator.clearAppBadge();
  const target = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: target });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
