// public/sw.js — TeamBridge Service Worker
// Handles push notifications and basic offline caching

const CACHE = 'tb-v2';

// ── Install: cache the app shell so iOS PWA never shows "This page couldn't load" ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.add('/')).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Remove old caches from previous versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for navigation, cache fallback so PWA always loads ──
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache fresh copy of the shell on every successful navigation
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put('/', copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        const cached = await caches.match('/');
        // If nothing cached yet, return a network error so iOS shows its native retry page
        // rather than crashing with an undefined response
        return cached ?? Response.error();
      })
  );
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
  // Clear badge when user taps the notification — try all API paths (mirrors setAppBadge logic)
  try {
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch?.(() => {});
    else if ('clearAppBadge' in self) self.clearAppBadge().catch?.(() => {});
    else if (self.navigator && 'clearAppBadge' in self.navigator) self.navigator.clearAppBadge().catch?.(() => {});
  } catch (_) {}
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
