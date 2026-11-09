/*
 * Service worker for Web Push (docs/notifications.md → Push). It is registered ON DEMAND, only when a person
 * turns push on in Account → Notifications (lib/push-client.ts); nothing else uses it, so it does no caching.
 * The server sends { title, body, url, tag }; this shows it and opens `url` when it is clicked.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: show the text as the body.
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'New notification';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/account/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse a tab that is already open on this site; otherwise open a new one.
      for (const client of windows) {
        if ('focus' in client) {
          if (client.url !== url && 'navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
