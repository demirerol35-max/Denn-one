// Regression tests for prayer push notifications in Deen One.
// Run: node --test tests/service-worker-push.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(now = Date.now()) {
  const handlers = {};
  const shown = [];
  const existing = [];
  const registration = {
    scope: 'https://example.org/app/',
    getNotifications: async () => existing,
    showNotification: async (title, options) => { shown.push({ title, options }); }
  };
  const context = {
    self: {
      registration,
      location: { origin: 'https://example.org' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
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
  return { push, shown, existing };
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
