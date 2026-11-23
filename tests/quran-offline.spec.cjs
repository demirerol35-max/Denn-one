const {test,expect}=require('@playwright/test');
const names={'ar.alafasy':'Alafasy','en.transliteration':'Transliteration','fr.hamidullah':'Muhammad Hamidullah','en.sahih':'Saheeh International','tr.diyanet':'Diyanet','de.bubenheim':'Bubenheim & Elyas'};
const edition=(number,identifier)=>({number,numberOfAyahs:4,englishName:'Fixture '+number,edition:{identifier,englishName:names[identifier]},ayahs:Array.from({length:4},(_,i)=>({numberInSurah:i+1,text:'Fixture '+number+' '+identifier+' verse '+(i+1),audio:'https://cdn.islamic.network/quran/audio/128/ar.alafasy/'+(i+1)+'.mp3'}))});
async function openQuran(page,state={}){
 page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(()=>{try{sessionStorage.setItem('deen-opening-seen','1')}catch{}});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='api.alquran.cloud'){
   if(state.offline)return route.abort();
   if(url.pathname==='/v1/meta')return route.fulfill({json:{code:200,data:{surahs:{references:Array.from({length:114},(_,i)=>({number:i+1,englishName:'Fixture '+(i+1),name:'اختبار'}))}}}});
   const match=url.pathname.match(/^\/v1\/surah\/(\d+)\/([a-z.]+)$/);
   if(match){
    if(state.hold?.surah===Number(match[1])&&state.hold?.edition===match[2])await state.hold.promise;
    const data=edition(Number(match[1]),match[2]);
    if(state.partial&&match[2]==='fr.hamidullah')data.ayahs.pop();
    return route.fulfill({json:{code:200,data}}).catch(()=>{});
   }
  }
  if(url.hostname!=='127.0.0.1')return route.abort();
  return route.continue();
 });
 await page.goto('/vision.html');
 await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await expect(page.locator('#verses')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#verses .quran-ayah')).toHaveCount(4);
}
async function choose(page,n){await page.locator('#surah').selectOption(String(n));await expect(page.locator('#verses')).toHaveAttribute('aria-busy','false');}
async function save(page){await expect(page.locator('#quran-offline-save')).toBeEnabled();await page.locator('#quran-offline-save').click();await expect(page.locator('#quran-offline-message')).toContainText('saved on this device');}

test('explicit save survives a truly offline reload, restores reading position, and can be deleted',async({page,context})=>{
 const state={};await openQuran(page,state);await choose(page,18);
 expect(await page.evaluate(async()=> (await caches.open('deen-quran-text-v1')).keys().then(keys=>keys.length))).toBe(0);
 await save(page);
 await expect(page.locator('#quran-text-source')).toContainText('Muhammad Hamidullah');
 await page.locator('#ayah-18-3 .quran-actions button').nth(1).click();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 state.offline=true;await context.setOffline(true);await page.reload();
 await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await expect(page.locator('#quran-status')).toContainText('local copy');
 await expect(page.locator('#surah')).toHaveValue('18');
 await expect(page.locator('#ayah-18-3 .quran-french-line')).toHaveText('Fixture 18 fr.hamidullah verse 3');
 await page.locator('#quran-continue').click();
 await expect(page.locator('#quran-status')).toContainText('local copy');
 await expect(page.locator('#ayah-18-3')).toBeInViewport();
 await page.locator('#quran-offline-list').selectOption('18:fr');await page.locator('#quran-offline-delete').click();
 await expect(page.locator('#quran-offline-message')).toHaveText('Copy deleted.');
 await choose(page,19);await choose(page,18);
 await expect(page.locator('#verses .quran-ayah')).toHaveCount(0);
 await expect(page.locator('#quran-status')).toContainText('no copy');
});

test('saved translation languages are distinct and an unavailable language is never substituted',async({page})=>{
 const state={};await openQuran(page,state);await choose(page,18);await save(page);
 await page.locator('#quran-translation-language').selectOption('tr');await expect(page.locator('#verses')).toHaveAttribute('aria-busy','false');await save(page);
 state.offline=true;
 await page.locator('#quran-translation-language').selectOption('de');
 await expect(page.locator('#quran-status')).toContainText('no copy');
 await expect(page.locator('#verses .quran-french-line')).toHaveCount(0);
 await page.locator('#quran-offline-list').selectOption('18:fr');await page.locator('#quran-offline-open').click();
 await expect(page.locator('#quran-status')).toContainText('local copy');
 await expect(page.locator('#quran-translation-language')).toHaveValue('fr');
 await expect(page.locator('#verses .quran-french-line').first()).toContainText('fr.hamidullah');
 await page.locator('#quran-offline-list').selectOption('18:tr');await page.locator('#quran-offline-open').click();
 await expect(page.locator('#verses .quran-french-line').first()).toContainText('tr.diyanet');
});

test('corrupted copies are rejected, remain removable and never replace text',async({page})=>{
 const state={};await openQuran(page,state);await choose(page,18);await save(page);
 await page.evaluate(async()=>{const cache=await caches.open('deen-quran-text-v1');await cache.put('./quran-offline/surah-18-fr.json',new Response('broken'));});
 state.offline=true;await page.reload();await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await expect(page.locator('#quran-status')).toContainText('no copy');
 await page.locator('#quran-offline-list').selectOption('18:fr');
 await expect(page.locator('#quran-offline-open')).toBeDisabled();
 await expect(page.locator('#quran-offline-delete')).toBeEnabled();
 await page.locator('#quran-offline-delete').click();await expect(page.locator('#quran-offline-message')).toHaveText('Copy deleted.');
});

test('partial editions disable saving while Arabic remains readable',async({page})=>{
 await openQuran(page,{partial:true});
 await expect(page.locator('#quran-offline-save')).toBeDisabled();
 await expect(page.locator('#quran-status')).toContainText('some editions are unavailable');
 await expect(page.locator('#verses .quran-ayah-text')).toHaveCount(4);
 await expect(page.locator('#verses .quran-french-line')).toHaveCount(0);
});

test('quota errors never claim success and do not interrupt reading',async({page})=>{
 await openQuran(page);
 await page.evaluate(()=>{const put=Cache.prototype.put;Cache.prototype.put=function(request,response){if(String(request).includes('quran-offline/'))return Promise.reject(new DOMException('Full','QuotaExceededError'));return put.call(this,request,response)}});
 await page.locator('#quran-offline-save').click();
 await expect(page.locator('#quran-offline-message')).toContainText('Unable to save');
 await expect(page.locator('#verses .quran-ayah-text')).toHaveCount(4);
 await expect(page.locator('#quran-offline-list option')).toHaveCount(1);
});

test('offline controls and live reading state follow all five interface languages on mobile',async({page})=>{
 await openQuran(page);
 for(const [language,label] of [['fr','Enregistrer cette sourate'],['tr','Bu sureyi kaydet'],['de','Diese Sure speichern'],['ar','حفظ هذه السورة'],['en','Save this surah']]){
  await page.locator('#app-language').evaluate((select,language)=>{select.value=language;select.dispatchEvent(new Event('change',{bubbles:true}))},language);
  await expect(page.locator('#quran-offline-save')).toHaveText(label);
  await expect(page.locator('#surah')).toHaveValue('112');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('a delayed translation for a previous surah cannot overwrite the selected one',async({page})=>{
 let release;const promise=new Promise(resolve=>{release=resolve});
 const state={hold:{surah:18,edition:'fr.hamidullah',promise}};
 await openQuran(page,state);
 await page.locator('#surah').selectOption('18');
 await expect(page.locator('#verses .quran-ayah-text').first()).toContainText('Fixture 18');
 await choose(page,19);release();
 await expect(page.locator('#verses .quran-french-line').first()).toContainText('Fixture 19 fr.hamidullah');
 await save(page);
 await expect(page.locator('#quran-offline-list option[value="19:fr"]')).toHaveCount(1);
 await expect(page.locator('#quran-offline-list option[value="18:fr"]')).toHaveCount(0);
});
