// Deen One: cache only the static application shell, never user/API data.
const CACHE = 'deen-one-shell-v7';
const SHELL = ['./', './index.html', './vision.html', './manifest.webmanifest', './deen-one-icon.svg'];
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

// Open the prayer screen when a notification is tapped. This handler does not
// schedule notifications: Android background delivery requires a push source.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('./vision.html#prayer', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) {
      try { if ('navigate' in existing) await existing.navigate(target); } catch (error) { /* Focus existing window if navigation is unsupported. */ }
      await existing.focus();
      return;
    }
    await self.clients.openWindow(target);
  })());
});
