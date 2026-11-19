const { test, expect } = require('@playwright/test');

test('offline app shell survives a network outage after installation', async ({ page, context }) => {
  await page.goto('http://127.0.0.1:8765/vision.html');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.installing) await new Promise(resolve => {
      registration.installing.addEventListener('statechange', function listener() {
        if (this.state === 'activated') resolve();
      });
    });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/Deen One/);
  await expect(page.locator('body')).toBeVisible();
});

test('optional asset failure does not prevent offline shell installation', async ({ page, context }) => {
  await page.route('**/deen-one-icon.svg', route => route.abort());
  await page.goto('http://127.0.0.1:8765/vision.html');
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active);
  }), { timeout: 15000 }).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle(/Deen One/);
});
