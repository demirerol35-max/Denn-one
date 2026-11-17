// Deen One: cache only the static application shell, never user/API data.
const CACHE = 'deen-one-shell-v4';
const SHELL = ['./', './index.html', './vision.html', './manifest.webmanifest'];
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('deen-one-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !SHELL_URLS.has(url.pathname)) return;
  // Avoid persisting query strings, including any potential private parameters.
  if (url.search) return;
  const key = new Request(url.origin + url.pathname);
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(key, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(key)) || Response.error()));
});
