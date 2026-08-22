const CACHE_NAME = 'life-os-shell-v39';
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

  // Never serve the application document, scripts or styles from an old shell.
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
