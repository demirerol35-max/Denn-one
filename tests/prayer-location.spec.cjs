const { test, expect } = require('@playwright/test');
const url = 'http://127.0.0.1:8765/vision.html';
test('manual location persists and keeps home synchronized', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('deen-home-location-mode')) localStorage.setItem('deen-home-location-mode','manual');
    if (!localStorage.getItem('deen-prayer-location')) localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Mulhouse',country:'FR',method:'12'}));
  });
  await page.route('https://api.aladhan.com/**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      date:{gregorian:{date:'19-11-2026'}},
      meta:{timezone:'Europe/Paris',latitude:47.75,longitude:7.33,method:{id:12}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => {document.querySelector('#prayer').hidden=false;});
  await expect(page.locator('#prayer-country option').filter({hasText:'Japon'})).toHaveCount(1);
  await expect(page.locator('#prayer-country option').filter({hasText:'Algérie'})).toHaveCount(1);
  await expect(page.locator('#prayer-city')).toHaveValue('Mulhouse');
  await page.locator('#prayer-country').selectOption('JP');
  await expect(page.locator('#prayer-city')).toHaveValue('');
  await page.reload();
  await expect(page.locator('#prayer-city')).toHaveValue('');
  await expect(page.locator('#prayer-country')).toHaveValue('JP');
});

test('GPS hides manual selectors and manual mode restores them', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude:47.75, longitude:7.33 });
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Mulhouse',country:'FR',method:'12'}));
  });
  await page.route('https://api.aladhan.com/**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      meta:{timezone:'Europe/Paris',latitude:47.75,longitude:7.33,method:{id:12}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await expect(page.locator('#prayer-manual-location')).toBeVisible();
  await page.locator('input[name="prayer-location-choice"][value="auto"]').check();
  await expect(page.locator('#prayer-manual-location')).toBeHidden();
  await page.locator('input[name="prayer-location-choice"][value="manual"]').check();
  await expect(page.locator('#prayer-manual-location')).toBeVisible();
  await page.reload();
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await expect(page.locator('input[name="prayer-location-choice"][value="manual"]')).toBeChecked();
  await expect(page.locator('#prayer-manual-location')).toBeVisible();
});

test('manual city updates the shared location and home requests the chosen country', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Mulhouse',country:'FR',method:'12'}));
  });
  const requests=[];
  await page.route('https://api.aladhan.com/**', async route => {
    requests.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      meta:{timezone:'Europe/Paris',latitude:47.75,longitude:7.33,method:{id:12}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => {document.querySelector('#prayer').hidden=false;});
  await page.locator('#prayer-city').fill('Strasbourg');
  await page.locator('#prayer-city').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('deen-prayer-location')||'null')?.city)).toBe('Strasbourg');
  await expect.poll(() => requests.some(x => x.includes('Strasbourg'))).toBeTruthy();
});

test('first visit defaults to manual mode without requesting GPS', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('deen-home-location-mode');
    localStorage.removeItem('deen-prayer-location');
  });
  await page.goto(url);
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await expect(page.locator('input[name="prayer-location-choice"][value="manual"]')).toBeChecked();
  await expect(page.locator('#prayer-manual-location')).toBeVisible();
  await expect(page.locator('input[name="prayer-location-choice"][value="auto"]')).not.toBeChecked();
});

test('clearing manual city removes stale prayer times from home', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Mulhouse',country:'FR',method:'12'}));
  });
  await page.route('https://api.aladhan.com/**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      meta:{timezone:'Europe/Paris',latitude:47.75,longitude:7.33,method:{id:12}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await page.locator('#prayer-city').fill('');
  await page.locator('#prayer-city').dispatchEvent('change');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('deen-prayer-location')||'null')?.city)).toBe('');
  await expect(page.locator('#home-prayer-times')).toBeEmpty();
  await expect(page.locator('#home-prayer-place')).toContainText(/Choisissez une ville|Choose a city|şehir seçin|Wählen Sie eine Stadt|اختر مدينة/);
});

test('manual prayer timings request uses city and country rather than GPS coordinates', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Oran',country:'DZ',method:'19'}));
  });
  const prayerRequests=[];
  await page.route('https://api.aladhan.com/**', async route => {
    prayerRequests.push(route.request().url());
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      meta:{timezone:'Africa/Algiers',latitude:35.7,longitude:-0.63,method:{id:19}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await expect.poll(() => prayerRequests.some(x => x.includes('/timingsByCity?') && x.includes('city=Oran'))).toBeTruthy();
  await expect.poll(() => prayerRequests.some(x => x.includes('country=Algeria'))).toBeTruthy();
  await expect(page.locator('#prayer-city')).toHaveValue('Oran');
  await expect(page.locator('#prayer-country')).toHaveValue('DZ');
});

test('manual prayer API returns five named prayer times', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Oran',country:'DZ',method:'19'}));
  });
  await page.route('https://api.aladhan.com/**', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      code:200,data:{timings:{Fajr:'05:30',Sunrise:'07:00',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'},
      meta:{timezone:'Africa/Algiers',latitude:35.7,longitude:-0.63,method:{id:19}}}
    })});
  });
  await page.goto(url);
  await page.evaluate(() => { document.querySelector('#prayer').hidden=false; });
  await expect.poll(async () => (await page.locator('#home-prayer-times').innerText()).trim().length).toBeGreaterThan(0);
  await expect(page.locator('#home-prayer-times')).toContainText('05:30');
  await expect(page.locator('#home-prayer-times')).toContainText('12:30');
  await expect(page.locator('#home-prayer-times')).toContainText('18:30');
});
