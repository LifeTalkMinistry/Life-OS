const CACHE_PREFIX = 'pause-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v44`;
const BASE_URL = new URL('./', self.location.href);

const toUrl = (path) => new URL(path, BASE_URL).href;
const SHELL_URL = toUrl('./');
const INDEX_URL = toUrl('./index.html');
const APP_SHELL = [
  SHELL_URL,
  INDEX_URL,
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
      .then((keys) => Promise.all(keys.map((key) => (
        key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME ? caches.delete(key) : null
      ))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl = null) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok && response.type !== 'opaque') {
      await cache.put(request, response.clone());
      if (request.mode === 'navigate' || request.destination === 'document') {
        await cache.put(SHELL_URL, response.clone());
        await cache.put(INDEX_URL, response.clone());
      }
    }
    return response;
  } catch {
    return (await cache.match(request))
      || (fallbackUrl ? await cache.match(fallbackUrl) : null)
      || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type !== 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation stays network-first so a normal online launch immediately picks up
  // the newest PAUSE build. The cached shell is only the offline fallback.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request, SHELL_URL));
    return;
  }

  // Development/source builds may still request standalone scripts and styles.
  // Keep them fresh online while retaining the last successful response offline.
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache only static presentation assets. API/data fetches are deliberately left
  // to the network so private or changing account data is never served from this cache.
  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'manifest') {
    event.respondWith(cacheFirst(request));
  }
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