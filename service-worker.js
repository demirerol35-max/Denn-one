// Deen One: cache only the static application shell, never user/API data.
const CACHE = 'deen-one-shell-v13';
const SHELL = ['./', './index.html', './vision.html', './manifest.webmanifest', './deen-one-icon.svg', './mosques.js'];
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // A single missing optional asset must not prevent the app shell from installing.
    await Promise.all(SHELL.map(async path => {
      try { await cache.add(path); } catch (error) { console.warn('Deen One: offline asset unavailable', path, error); }
    }));
    // The main page must be available before activating the new offline worker.
    if (!(await cache.match('./vision.html'))) {
      await caches.delete(CACHE);
      throw new Error('Deen One: main page not cached');
    }
  }).then(() => self.skipWaiting()));
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


// Receive server-sent Web Push messages while the app is closed.
// A push subscription and a trusted scheduling server are still required.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (_) { return; }
    if (!data || data.type !== 'prayer' || typeof data.prayer !== 'string') return;
    const allowed = new Set(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    if (!allowed.has(data.prayer)) return;
    // Do not display a prayer alert delivered long after its scheduled time.
    // The sending service should include a Unix-millisecond scheduledAt value.
    if (!Number.isSafeInteger(data.scheduledAt)) return;
    const delay = Date.now() - data.scheduledAt;
    // Never announce a prayer before its scheduled time; reject significantly late deliveries.
    if (delay < 0 || delay > 10 * 60 * 1000) return;
    const prayerNames = {
      fr: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Icha' },
      tr: { Fajr: 'Sabah', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' },
      ar: { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
      en: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
      de: { Fajr: 'Fadschr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Ischa' }
    };
    const messages = {
      fr: 'C’est l’heure de la prière.',
      tr: 'Namaz vakti geldi.',
      ar: 'حان وقت الصلاة.',
      en: 'It is time for prayer.',
      de: 'Es ist Zeit für das Gebet.'
    };
    const lang = Object.prototype.hasOwnProperty.call(messages, data.lang) ? data.lang : 'fr';
    const title = 'Deen One · ' + prayerNames[lang][data.prayer];
    const options = {
      body: messages[lang],
      icon: './deen-one-icon.svg',
      badge: './deen-one-icon.svg',
      tag: 'deen-one-prayer-' + data.prayer + '-' + (data.scheduledAt),
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      timestamp: data.scheduledAt,
      data: { kind: 'prayer' }
    };
    // Duplicate push deliveries should not vibrate or alert twice.
    // A transient failure while checking existing notifications must not
    // silently prevent a time-sensitive prayer reminder from appearing.
    try {
      const existing = await self.registration.getNotifications({ tag: options.tag });
      if (existing.length) return;
    } catch (error) {
      console.warn('Deen One: notification deduplication unavailable', error);
    }
    await self.registration.showNotification(title, options);
  })());
});

// Open the prayer screen when a notification is tapped. This handler does not
// schedule notifications: Android background delivery requires a push source.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Route prayer alerts to Prayer; ordinary/test notifications to the home screen.
  // Never follow an arbitrary URL supplied in a notification payload.
  const note = event.notification;
  const isPrayer = note.data?.kind === 'prayer' ||
    (typeof note.tag === 'string' && (note.tag.startsWith('deen-one-prayer-') || note.tag.startsWith('deen-prayer-')));
  const target = new URL(isPrayer ? './vision.html#prayer' : './vision.html#home', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const existing = windows.find(client => {
      try {
        const url = new URL(client.url);
        return url.origin === self.location.origin &&
          url.pathname.startsWith(new URL(self.registration.scope).pathname);
      } catch (_) { return false; }
    });
    if (existing) {
      try {
        if ('navigate' in existing) {
          const navigated = await existing.navigate(target);
          await (navigated || existing).focus();
          return;
        }
      } catch (_) { /* Fall back to opening the correct prayer URL. */ }
      if (existing.url === target) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(target);
      return;
    }
    await self.clients.openWindow(target);
  })());
});
