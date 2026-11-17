// Deen One — cache local du coeur de l'application.
// Les données externes (horaires, géolocalisation, API, audio distant)
// ne sont jamais mises en cache ici.
const CACHE = 'deen-one-shell-v3';
const APP_SHELL = ['./', './index.html', './vision.html', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('deen-one-') && key !== CACHE)
          .map(key => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Network-first: show updates promptly, fall back to cached pages offline.
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await caches.match('./vision.html')) ||
          (await caches.match('./index.html')) ||
          Response.error();
      }
      return Response.error();
    })
  );
});
