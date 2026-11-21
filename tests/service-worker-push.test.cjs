// Regression tests for prayer push notifications in Deen One.
// Run: node --test tests/service-worker-push.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(now = Date.now(), lookupFails = false) {
  const handlers = {};
  const shown = [];
  const existing = [];
  const opened = [];
  const registration = {
    scope: 'https://example.org/app/',
    getNotifications: async () => { if (lookupFails) throw new Error('temporary lookup failure'); return existing; },
    showNotification: async (title, options) => { shown.push({ title, options }); }
  };
  const context = {
    self: {
      registration,
      location: { origin: 'https://example.org' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async url => { opened.push(url); } }
    },
    caches: {},
    URL, Request, Response, Set, Promise, console,
    Date: class extends Date { static now() { return now; } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8'), context);
  async function push(payload) {
    let pending;
    handlers.push({
      data: { json: () => payload },
      waitUntil: promise => { pending = promise; }
    });
    await pending;
  }
  async function click(notification) {
    let pending;
    handlers.notificationclick({ notification: { ...notification, close: () => {} }, waitUntil: promise => { pending = promise; } });
    await pending;
  }
  return { push, shown, existing, opened, click };
}

test('valid prayer push displays localized notification', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Isha', lang: 'fr', scheduledAt: now - 1000 });
  assert.equal(app.shown.length, 1);
  assert.match(app.shown[0].title, /Icha/);
  assert.equal(app.shown[0].options.data.kind, 'prayer');
});

test('rejects invalid prayer, early and late alerts', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Other', scheduledAt: now });
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: now + 60000 });
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: now - 11 * 60000 });
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: 'invalid' });
  assert.equal(app.shown.length, 0);
});

test('duplicate push does not show another notification', async () => {
  const now = Date.now();
  const app = setup(now);
  const payload = { type: 'prayer', prayer: 'Asr', scheduledAt: now };
  await app.push(payload);
  app.existing.push(app.shown[0].options);
  await app.push(payload);
  assert.equal(app.shown.length, 1);
});

test('unknown language falls back to French', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Isha', lang: 'xx', scheduledAt: now });
  assert.match(app.shown[0].title, /Icha/);
});

test('supports all five interface languages and Arabic direction', async () => {
  const now = Date.now();
  for (const lang of ['fr', 'tr', 'ar', 'en', 'de']) {
    const app = setup(now);
    await app.push({ type: 'prayer', prayer: 'Fajr', lang, scheduledAt: now });
    assert.equal(app.shown.length, 1, lang);
    assert.equal(app.shown[0].options.lang, lang);
    assert.equal(app.shown[0].options.dir, lang === 'ar' ? 'rtl' : 'ltr');
  }
});

test('rejects unrelated push payloads', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'advertisement', prayer: 'Fajr', scheduledAt: now });
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: 1.5 });
  await app.push(null);
  assert.equal(app.shown.length, 0);
});

test('accepts prayer exactly at scheduled time and at ten-minute boundary', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Dhuhr', lang: 'en', scheduledAt: now });
  await app.push({ type: 'prayer', prayer: 'Maghrib', lang: 'tr', scheduledAt: now - 10 * 60000 });
  assert.equal(app.shown.length, 2);
  assert.match(app.shown[0].title, /Dhuhr/);
  assert.match(app.shown[1].title, /Akşam/);
});

test('notification tag uniquely identifies prayer and scheduled time', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: now });
  await app.push({ type: 'prayer', prayer: 'Dhuhr', scheduledAt: now });
  assert.equal(app.shown.length, 2);
  assert.notEqual(app.shown[0].options.tag, app.shown[1].options.tag);
  assert.equal(app.shown[0].options.timestamp, now);
});

test('temporary notification lookup failure does not suppress prayer reminder', async () => {
  const now = Date.now();
  const app = setup(now, true);
  await app.push({ type: 'prayer', prayer: 'Fajr', lang: 'fr', scheduledAt: now });
  assert.equal(app.shown.length, 1);
});

test('tapping a prayer alert opens the prayer screen', async () => {
  const now = Date.now();
  const app = setup(now);
  await app.push({ type: 'prayer', prayer: 'Fajr', scheduledAt: now });
  await app.click(app.shown[0].options);
  assert.equal(app.opened.length, 1);
  assert.equal(app.opened[0], 'https://example.org/app/vision.html#prayer');
});

test('ordinary notification opens home without trusting payload URLs', async () => {
  const app = setup();
  await app.click({ tag: 'other', data: { url: 'https://malicious.example/' } });
  assert.equal(app.opened[0], 'https://example.org/app/vision.html#home');
});
