const CACHE_NAME = 'life-os-shell-v10';
const BASE_URL = new URL('./', self.location.href);

const toUrl = (path) => new URL(path, BASE_URL).href;
const APP_SHELL = [
  toUrl('./'),
  toUrl('./index.html'),
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
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(toUrl('./index.html'), copy));
          return response;
        })
        .catch(async () =>
          (await caches.match(toUrl('./index.html'))) ||
          (await caches.match(toUrl('./')))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
