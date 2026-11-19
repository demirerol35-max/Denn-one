const { test, expect } = require('@playwright/test');
const url = 'http://127.0.0.1:8765/vision.html';
test('manual location persists and keeps home synchronized', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('deen-home-location-mode','manual');
    localStorage.setItem('deen-prayer-location',JSON.stringify({city:'Mulhouse',country:'FR',method:'12'}));
  });
  await page.route('https://api.aladhan.com/**', async route => {
    const requestUrl = new URL(route.request().url());
    const city = requestUrl.searchParams.get('city') || 'GPS';
    const country = requestUrl.searchParams.get('country') || 'France';
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
