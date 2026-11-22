// Deen One — guarded Mushaf edition loader. No fabricated pages or substituted riwaya.
export const EDITIONS=Object.freeze({
 hafs:{label:"Hafs d'après ‘Âsim",expectedPages:604},
 warsh:{label:"Warsh d'après Nâfi‘",expectedPages:null}
});
export function validateMushafManifest(manifest,edition){
 if(!Object.hasOwn(EDITIONS,edition))throw Error('Édition inconnue');
 if(!manifest||manifest.edition!==edition)throw Error('Édition du fichier incorrecte');
 if(!Number.isInteger(manifest.version)||manifest.version!==1)throw Error('Version du manifeste incorrecte');
 if(typeof manifest.source!=='string'||!manifest.source.trim()||typeof manifest.license!=='string'||!manifest.license.trim()||manifest.reviewed!==true)throw Error('Source, droits et validation éditoriale obligatoires');
 if(!Array.isArray(manifest.pages)||!manifest.pages.length)throw Error('Pages manquantes');
 const expected=EDITIONS[edition].expectedPages;
 if(expected!==null&&manifest.pages.length!==expected)throw Error('Pagination Hafs incorrecte');
 const seen=new Set();
 manifest.pages.forEach((page,index)=>{
  if(!page||page.number!==index+1||!Number.isInteger(page.number)||typeof page.image!=='string'||!page.image.startsWith('mushaf-assets/'+edition+'/')||!/^mushaf-assets\/[a-z0-9_-]+\/[a-z0-9_-]+\.(png|webp|jpg)$/i.test(page.image)||typeof page.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(page.sha256)||seen.has(page.image))throw Error('Page non vérifiée : '+(index+1));
  seen.add(page.image);
 });
 return Object.freeze({version:1,edition,source:manifest.source,license:manifest.license,reviewed:true,pages:Object.freeze(manifest.pages.map(p=>Object.freeze({...p})))});
}
export function nextPage(page,total,direction){
 if(!Number.isInteger(total)||total<1)throw Error('Nombre de pages incorrect');
 if(!Number.isInteger(page)||page<1||page>total)throw Error('Page actuelle incorrecte');
 if(direction!=='next'&&direction!=='previous')throw Error('Direction incorrecte');
 return Math.min(total,Math.max(1,Math.trunc(page||1)+(direction==='next'?1:-1)));
}
// SHA-256 validation checks actual page bytes, not merely the manifest's claimed hash.
export async function verifyPageBytes(bytes,expectedSha256){
 if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/i.test(expectedSha256))return false;
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 indisponible');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 return actual===expectedSha256.toLowerCase();
}


export function mushafSpread(page,total,doublePage=false){
 nextPage(page,total,'next');
 if(typeof doublePage!=='boolean')throw Error('Présentation incorrecte');
 if(!doublePage)return [page];
 const start=page%2===0?page-1:page;
 return start<total?[start,start+1]:[start];
}
export function turnMushafSpread(page,total,direction,doublePage=false){
 const pages=mushafSpread(page,total,doublePage);
 const single=nextPage(page,total,direction);
 if(!doublePage)return single;
 const lastStart=total%2===0?total-1:total;
 const target=direction==='next'?Math.min(lastStart,pages[0]+2):Math.max(1,pages[0]-2);
 return target===pages[0]?page:target;
}

// Keep verified Mushaf content separate from the service worker's application shell.
const MANIFEST_CACHE='deen-mushaf-manifests-v1';
const PAGE_CACHE='deen-mushaf-pages-v1';
export const MAX_CACHED_PAGES=12;
function checkAbort(signal){
 if(signal?.aborted)throw signal.reason||new DOMException('Chargement annulé','AbortError');
}
async function optionalCache(storage,name){
 try{return await storage?.open(name)||null}catch{return null}
}
async function fetchWithDeadline(fetcher,url,signal,timeoutMs,consume){
 checkAbort(signal);
 const controller=new AbortController();
 const abort=()=>controller.abort(signal.reason);
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Délai de chargement dépassé','TimeoutError')),timeoutMs);
 try{return await consume(await fetcher(url,{signal:controller.signal,cache:'no-store'}))}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
export async function loadMushafManifest(edition,{fetcher=globalThis.fetch,cacheStorage=globalThis.caches,signal,timeoutMs=15000}={}){
 if(!Object.hasOwn(EDITIONS,edition))throw Error('Édition inconnue');
 checkAbort(signal);
 const url='./mushaf-assets/'+edition+'/manifest.json';
 const cache=await optionalCache(cacheStorage,MANIFEST_CACHE);
 let response;
 try{response=await fetchWithDeadline(fetcher,url,signal,timeoutMs,async response=>({ok:response.ok,status:response.status,data:response.ok?await response.text():null}))}
 catch(error){
  checkAbort(signal);
  let cached=null;
  try{cached=await cache?.match(url)}catch{}
  if(!cached)throw error;
  let manifest;
  try{manifest=validateMushafManifest(await cached.json(),edition)}
  catch(error){try{await cache?.delete(url)}catch{}throw error}
  checkAbort(signal);
  return {manifest,offline:true};
 }
 checkAbort(signal);
 // An explicitly withdrawn or invalid edition must never be revived from cache.
 if(!response.ok){
  if([401,403,404,410].includes(response.status)){try{await cache?.delete(url)}catch{}}
  throw Error('Édition non publiée ou non validée');
 }
 let manifest;
 try{manifest=validateMushafManifest(JSON.parse(response.data),edition)}
 catch(error){try{await cache?.delete(url)}catch{}throw error}
 checkAbort(signal);
 try{await cache?.put(url,new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}))}catch{}
 checkAbort(signal);
 return {manifest,offline:false};
}
export async function loadVerifiedMushafPage(page,{fetcher=globalThis.fetch,cacheStorage=globalThis.caches,signal,timeoutMs=15000}={}){
 if(!page||!/^mushaf-assets\/(hafs|warsh)\/[a-z0-9_-]+\.(png|webp|jpg)$/i.test(page.image)||!/^[a-f0-9]{64}$/i.test(page.sha256))throw Error('Page non vérifiée');
 checkAbort(signal);
 const cache=await optionalCache(cacheStorage,PAGE_CACHE);
 // A publisher replacing a page at the same path cannot mix old and new bytes.
 const key='./'+page.image+'?sha256='+page.sha256.toLowerCase();
 let cached=null;
 try{cached=await cache?.match(key)}catch{}
 if(cached){
  const bytes=await cached.arrayBuffer();
  const valid=await verifyPageBytes(bytes,page.sha256);
  checkAbort(signal);
  if(valid)return {bytes,fromCache:true};
  try{await cache.delete(key)}catch{}
 }
 const response=await fetchWithDeadline(fetcher,'./'+page.image,signal,timeoutMs,async response=>({ok:response.ok,bytes:response.ok?await response.arrayBuffer():null}));
 if(!response.ok)throw Error('Page introuvable');
 const bytes=response.bytes;
 checkAbort(signal);
 if(!await verifyPageBytes(bytes,page.sha256))throw Error('Empreinte SHA-256 incorrecte');
 checkAbort(signal);
 // Cache failures (private mode, quota) must not prevent verified online reading.
 try{
  await cache?.put(key,new Response(bytes));
  const keys=await cache?.keys()||[];
  for(const entry of keys.slice(0,Math.max(0,keys.length-MAX_CACHED_PAGES)))await cache.delete(entry);
 }catch{}
 checkAbort(signal);
 return {bytes,fromCache:false};
}


