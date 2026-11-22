const {test,expect}=require('@playwright/test');
const {createHash}=require('node:crypto');
const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWN49/Tsu6dnGVAoAKY7D8HbkeaDAAAAAElFTkSuQmCC','base64');
const digest=createHash('sha256').update(fixture).digest('hex');
async function expectSpreadPainted(page){
 await page.locator('#mushaf-page-spread').scrollIntoViewIfNeeded();
 await expect.poll(async()=>{
  const boxes=await Promise.all(['#mushaf-page-image','#mushaf-page-image-second'].map(id=>page.locator(id).boundingBox()));
  const height=page.viewportSize().height;
  const points=boxes.map(box=>({x:Math.floor(box.x+box.width/2),y:Math.floor((Math.max(100,box.y)+Math.min(height-1,box.y+box.height))/2)}));
  const png=(await page.screenshot()).toString('base64');
  return page.evaluate(async({png,points})=>{
   const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return points.map(({x,y})=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3));
  },{png,points});
 }).toEqual([[238,229,205],[238,229,205]]);
}
async function openReader(page,{edition='hafs',tamper=false}={}){
 page.on('dialog',dialog=>dialog.accept());
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='127.0.0.1')return route.abort();
  const match=url.pathname.match(/\/mushaf-assets\/(hafs|warsh)\/manifest.json$/);
  if(match){
   const selected=match[1];
   return route.fulfill({json:{version:1,edition:selected,source:'Automated UI fixture only',license:'Synthetic fixture',reviewed:true,pages:Array.from({length:604},(_,i)=>({number:i+1,image:'mushaf-assets/'+selected+'/'+String(i+1).padStart(3,'0')+'.png',sha256:digest}))}});
  }
  if(/\/mushaf-assets\/(hafs|warsh)\/\d{3}\.png$/.test(url.pathname)){
   return route.fulfill({body:tamper&&url.pathname.endsWith('/002.png')?Buffer.from('corrupt fixture'):fixture,contentType:'image/png'});
  }
  return route.continue();
 });
 await page.goto('/vision.html');
 // Invoke the application's existing route handler; this suite targets the reader component.
 await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await expect(page.locator('#quran')).toBeVisible();
 await page.locator('#mushaf-open-'+edition).click();
 await expect(page.locator('#mushaf-reader')).toBeVisible();
}
test('wide-screen book has two verified pages in RTL order and advances by a spread',async({page})=>{
 await openReader(page);
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 1–2 / 604');
 const first=await page.locator('#mushaf-page-image').boundingBox(),second=await page.locator('#mushaf-page-image-second').boundingBox();
 expect(first.x).toBeGreaterThan(second.x);
 await expectSpreadPainted(page);
 await expect(page.locator('#mushaf-prev')).toBeDisabled();
 await page.locator('#mushaf-next').click();
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 3–4 / 604');
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-jump').fill('604');await page.locator('#mushaf-jump-go').click();
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 603–604 / 604');
 await expect(page.locator('#mushaf-next')).toBeDisabled();
});

test('reader labels and errors follow all five interface languages without resetting the page',async({page})=>{
 await openReader(page,{edition:'warsh'});
 await expect(page.locator('#mushaf-open-warsh')).toHaveText('Open Warsh');
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-jump').fill('300');await page.locator('#mushaf-jump-go').click();
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 for(const [language,single,caption,retry]of [
  ['en','Single page','Page 299','Retry'],['tr','Tek sayfa','Sayfa 299','Yeniden dene'],
  ['de','Eine Seite','Seite 299','Erneut versuchen'],['ar','صفحة واحدة','الصفحة 299','إعادة المحاولة'],['fr','Une page','Page 299','Réessayer']
 ]){
  await page.locator('#app-language').evaluate((select,language)=>{select.value=language;select.dispatchEvent(new Event('change',{bubbles:true}))},language);
  await expect(page.locator('#mushaf-layout option[value="single"]')).toHaveText(single);
  await expect(page.locator('#mushaf-caption-first')).toHaveText(caption);
  await expect(page.locator('#mushaf-retry')).toHaveText(retry);
  await expect(page.locator('#mushaf-jump')).toHaveValue('300');
  await page.locator('#mushaf-jump').fill('0');await page.locator('#mushaf-jump-go').click();
  if(language!=='fr')await expect(page.locator('#mushaf-reader-message')).not.toContainText('Choisis une page');
  if(language==='fr')await expect(page.locator('#mushaf-reader-message')).toContainText('Choisis une page');
  await page.locator('#mushaf-jump').fill('300');
 }
});
test('reload restores the language, chosen layout and separate Hafs and Warsh positions',async({page})=>{
 await openReader(page,{edition:'warsh'});
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-layout').selectOption('single');
 await page.locator('#mushaf-jump').fill('300');await page.locator('#mushaf-jump-go').click();
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#app-language').evaluate(select=>{select.value='tr';select.dispatchEvent(new Event('change',{bubbles:true}))});
 await page.reload();
 await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await expect(page.locator('#mushaf-layout')).toHaveValue('single');
 await expect(page.locator('#mushaf-open-warsh')).toHaveText('Verş’i aç');
 await page.locator('#mushaf-open-warsh').click();
 await expect(page.locator('#mushaf-counter')).toHaveText('Sayfa 300 / 604');
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-open-hafs').click();
 await expect(page.locator('#mushaf-counter')).toHaveText('Sayfa 1 / 604');
});

test('auto layout switches to one page on mobile and preserves the requested even page',async({page})=>{
 await openReader(page,{edition:'warsh'});
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-jump').fill('300');await page.locator('#mushaf-jump-go').click();
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 299–300 / 604');
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#mushaf-counter')).toHaveText('Page 300 / 604');
 await expect(page.locator('#mushaf-sheet-second')).toBeHidden();
 await expect(page.locator('#mushaf-page-image')).toHaveAttribute('alt','Warsh · page 300');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('zoom pans inside the book without turning pages with arrow keys or swipes',async({page})=>{
 await openReader(page);
 await expect(page.locator('#mushaf-reader')).toHaveAttribute('aria-busy','false');
 await page.locator('#mushaf-zoom-in').click();
 await expect(page.locator('#mushaf-zoom-value')).toHaveText('125 %');
 await page.locator('#mushaf-page-surface').focus();await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 1–2 / 604');
 await page.locator('#mushaf-page-surface').evaluate(surface=>{
  const start=new Event('touchstart');Object.defineProperty(start,'touches',{value:[{clientX:250,clientY:100}]});surface.dispatchEvent(start);
  const end=new Event('touchend');Object.defineProperty(end,'changedTouches',{value:[{clientX:100,clientY:100}]});surface.dispatchEvent(end);
 });
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 1–2 / 604');
 expect(await page.locator('#mushaf-page-surface').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
 await page.locator('#mushaf-zoom-reset').click();await page.locator('#mushaf-page-surface').focus();await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 3–4 / 604');
});
test('a corrupt companion page blocks both images and never saves a reading position',async({page})=>{
 await openReader(page,{tamper:true});
 await expect(page.locator('#mushaf-retry')).toBeVisible();
 await expect(page.locator('#mushaf-page-image')).not.toHaveAttribute('src',/./);
 await expect(page.locator('#mushaf-page-image-second')).not.toHaveAttribute('src',/./);
 expect(await page.evaluate(()=>localStorage.getItem('deen-mushaf-page-hafs'))).toBeNull();
 await expect(page.locator('#mushaf-next')).toBeDisabled();
});

test('Arabic alphabet quiz starts and accepts an answer without its former initialization error',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await openReader(page);
 await page.locator('[data-tab="arabic"]').first().evaluate(button=>button.click());
 await page.locator('#deen-arabic-start').click();
 await expect(page.locator('#deen-arabic-answers button')).toHaveCount(4);
 await expect(page.locator('#deen-arabic-question')).toContainText(/[\u0600-\u06ff]/);
 await page.locator('#deen-arabic-answers button').first().click();
 await expect(page.locator('#deen-arabic-answers button')).toHaveCount(5);
 expect(errors.filter(message=>message.includes("Cannot access 'word'"))).toEqual([]);
});

test('page bookmarks survive reload, remain edition-specific and can be removed',async({page})=>{
 await openReader(page,{edition:'hafs'});
 await expect(page.locator('#mushaf-bookmark-toggle')).toBeEnabled();
 await page.locator('#mushaf-bookmark-toggle').click();
 await expect(page.locator('#mushaf-bookmark-toggle')).toHaveAttribute('aria-pressed','true');
 await page.locator('#mushaf-jump').fill('300');await page.locator('#mushaf-jump-go').click();
 await expect(page.locator('#mushaf-bookmark-toggle')).toBeEnabled();
 await page.locator('#mushaf-bookmark-toggle').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('deen-mushaf-bookmarks-hafs')).pages)).toEqual([1,300]);
 await page.locator('#mushaf-open-warsh').click();
 await expect(page.locator('#mushaf-bookmark-toggle')).toBeEnabled();
 await expect(page.locator('#mushaf-bookmarks')).toBeDisabled();
 await expect(page.locator('#mushaf-bookmark-toggle')).toHaveAttribute('aria-pressed','false');
 await page.reload();
 await page.locator('[data-tab="quran"]').first().evaluate(button=>button.click());
 await page.locator('#mushaf-open-hafs').click();
 await expect(page.locator('#mushaf-bookmark-toggle')).toBeEnabled();
 await expect(page.locator('#mushaf-bookmark-toggle')).toHaveAttribute('aria-pressed','true');
 await page.locator('#mushaf-bookmarks').selectOption('1');
 await expect(page.locator('#mushaf-counter')).toHaveText('Pages 1–2 / 604');
 await expect(page.locator('#mushaf-bookmark-toggle')).toBeEnabled();
 await page.locator('#mushaf-bookmark-toggle').click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('deen-mushaf-bookmarks-hafs')).pages)).toEqual([300]);
 await page.locator('#app-language').evaluate(select=>{select.value='tr';select.dispatchEvent(new Event('change',{bubbles:true}))});
 await expect(page.locator('#mushaf-bookmark-toggle')).toHaveText('☆ 1. sayfayı ekle');
 await expect(page.locator('#mushaf-bookmarks option[value="300"]')).toHaveText('Sayfa 300');
});



