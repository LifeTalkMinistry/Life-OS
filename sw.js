const CACHE_NAME = 'pause-shell-v42';
const BASE_URL = new URL('./', self.location.href);

const toUrl = (path) => new URL(path, BASE_URL).href;
const APP_SHELL = [
  toUrl('./manifest.webmanifest'),
  toUrl('./pwa/icon-192.png'),
  toUrl('./pwa/icon-512.png'),
  toUrl('./pwa/icon-maskable-512.png'),
  toUrl('./pwa/apple-touch-icon.png')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => key === CACHE_NAME ? null : caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function freshFetch(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' || request.destination === 'document' || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(freshFetch(request));
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || '' };
  }

  const title = String(payload.title || 'PAUSE');
  const body = String(payload.body || '');
  const targetUrl = new URL(String(payload.url || './'), BASE_URL).href;
  const options = {
    body,
    icon: toUrl('./pwa/icon-192.png'),
    badge: toUrl('./pwa/icon-192.png'),
    tag: String(payload.tag || payload.eventType || 'pause-recovery-nudge'),
    renotify: false,
    data: {
      url: targetUrl,
      eventType: String(payload.eventType || ''),
      dedupeKey: String(payload.dedupeKey || '')
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || BASE_URL.href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(targetUrl);
    for (const client of windows) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === target.origin && clientUrl.pathname.startsWith(BASE_URL.pathname)) {
          await client.focus();
          if (client.url !== targetUrl && 'navigate' in client) await client.navigate(targetUrl);
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(targetUrl);
  })());
});
