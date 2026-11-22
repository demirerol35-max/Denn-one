import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadMushafManifest,loadVerifiedMushafPage,MAX_CACHED_PAGES} from '../mushaf.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const page=(edition='hafs',n=1,bytes='page')=>({number:n,image:`mushaf-assets/${edition}/${n}.webp`,sha256:hash(bytes)});
const manifest=edition=>({version:1,edition,source:'Test fixture only',license:'Test',reviewed:true,pages:Array.from({length:edition==='hafs'?604:2},(_,i)=>page(edition,i+1))});
function memoryStorage(){
 const stores=new Map();
 const normalize=key=>new URL(key.url||key,'https://example.org/app/').href;
 return {stores,async open(name){
  if(!stores.has(name))stores.set(name,new Map());
  const data=stores.get(name);
  return {async match(key){return data.get(normalize(key))?.clone()},async put(key,response){data.set(normalize(key),response.clone())},async delete(key){return data.delete(normalize(key))},async keys(){return [...data.keys()]}};
 }};
}
const offline=async()=>{throw new TypeError('Network offline')};
test('manifest is revalidated offline and Hafs and Warsh caches remain separate',async()=>{
 const cacheStorage=memoryStorage();
 for(const edition of ['hafs','warsh']){
  const online=await loadMushafManifest(edition,{cacheStorage,fetcher:async()=>Response.json(manifest(edition))});
  assert.equal(online.offline,false);
  const restored=await loadMushafManifest(edition,{cacheStorage,fetcher:offline});
  assert.equal(restored.offline,true);assert.equal(restored.manifest.edition,edition);
  assert.equal(restored.manifest.pages.length,edition==='hafs'?604:2);
 }
});
test('withdrawn, malformed and unreviewed network manifests cannot revive cached editions',async()=>{
 const cacheStorage=memoryStorage();
 await loadMushafManifest('hafs',{cacheStorage,fetcher:async()=>Response.json(manifest('hafs'))});
 for(const response of [new Response('',{status:404}),new Response('broken JSON'),Response.json({...manifest('hafs'),reviewed:false})]){
  await assert.rejects(loadMushafManifest('hafs',{cacheStorage,fetcher:async()=>response}));
 }
});
test('invalid manifests in local storage are never trusted',async()=>{
 const cacheStorage=memoryStorage(),cache=await cacheStorage.open('deen-mushaf-manifests-v1');
 await cache.put('./mushaf-assets/hafs/manifest.json',Response.json(manifest('warsh')));
 await assert.rejects(loadMushafManifest('hafs',{cacheStorage,fetcher:offline}));
});
test('only verified bytes are saved and cached bytes are verified again',async()=>{
 const cacheStorage=memoryStorage(),p=page();
 const loaded=await loadVerifiedMushafPage(p,{cacheStorage,fetcher:async()=>new Response('page')});
 assert.equal(loaded.fromCache,false);
 const cached=await loadVerifiedMushafPage(p,{cacheStorage,fetcher:offline});
 assert.equal(cached.fromCache,true);assert.equal(new TextDecoder().decode(cached.bytes),'page');
 const cache=await cacheStorage.open('deen-mushaf-pages-v1');
 const key='./'+p.image+'?sha256='+p.sha256;
 await cache.put(key,new Response('tampered'));
 await assert.rejects(loadVerifiedMushafPage(p,{cacheStorage,fetcher:offline}));
 assert.equal(await cache.match(key),undefined);
 await assert.rejects(loadVerifiedMushafPage(p,{cacheStorage,fetcher:async()=>new Response('tampered')}));
 assert.equal(await cache.match(key),undefined);
});
test('page version and edition cannot reuse another cached image',async()=>{
 const cacheStorage=memoryStorage();
 await loadVerifiedMushafPage(page(),{cacheStorage,fetcher:async()=>new Response('page')});
 await assert.rejects(loadVerifiedMushafPage(page('warsh'),{cacheStorage,fetcher:offline}));
 await assert.rejects(loadVerifiedMushafPage(page('hafs',1,'new-version'),{cacheStorage,fetcher:offline}));
});
test('page storage remains bounded',async()=>{
 const cacheStorage=memoryStorage();
 for(let n=1;n<=MAX_CACHED_PAGES+3;n++)await loadVerifiedMushafPage(page('hafs',n),{cacheStorage,fetcher:async()=>new Response('page')});
 const keys=await (await cacheStorage.open('deen-mushaf-pages-v1')).keys();
 assert.equal(keys.length,MAX_CACHED_PAGES);
 assert.ok(keys.every(key=>!key.includes('/1.webp?')));
});
test('unavailable or full storage preserves online reading',async()=>{
 for(const cacheStorage of [null,{async open(){throw Error('Private mode')}},{async open(){return {async match(){return undefined},async put(){throw Error('Quota')}}}}]){
  const loaded=await loadVerifiedMushafPage(page(),{cacheStorage,fetcher:async()=>new Response('page')});
  assert.equal(new TextDecoder().decode(loaded.bytes),'page');
  assert.equal((await loadMushafManifest('hafs',{cacheStorage,fetcher:async()=>Response.json(manifest('hafs'))})).manifest.edition,'hafs');
 }
});
test('cancelled loads do not fall back to cache or start another fetch',async()=>{
 const cacheStorage=memoryStorage(),controller=new AbortController();
 await loadMushafManifest('hafs',{cacheStorage,fetcher:async()=>Response.json(manifest('hafs'))});
 controller.abort();
 let fetched=false;
 const fetcher=async()=>{fetched=true;throw Error('Should not fetch')};
 await assert.rejects(loadMushafManifest('hafs',{cacheStorage,signal:controller.signal,fetcher}),{name:'AbortError'});
 await assert.rejects(loadVerifiedMushafPage(page(),{cacheStorage,signal:controller.signal,fetcher}),{name:'AbortError'});
 assert.equal(fetched,false);
});

test('installed service worker serves the reader module offline and preserves verified-page caches',async()=>{
 const cacheStorage=memoryStorage(),open=cacheStorage.open.bind(cacheStorage),handlers={};
 const moduleBody=readFileSync(new URL('../mushaf.mjs',import.meta.url),'utf8');
 cacheStorage.open=async name=>{
  const cache=await open(name);
  cache.add=async key=>cache.put(key,new Response(key==='./mushaf.mjs'?moduleBody:'shell'));
  return cache;
 };
 cacheStorage.keys=async()=>[...cacheStorage.stores.keys()];
 cacheStorage.delete=async name=>cacheStorage.stores.delete(name);
 cacheStorage.match=async key=>{
  for(const name of await cacheStorage.keys()){const found=await (await cacheStorage.open(name)).match(key);if(found)return found}
 };
 await cacheStorage.open('deen-one-shell-old');
 await cacheStorage.open('deen-mushaf-pages-v1');
 await cacheStorage.open('deen-mushaf-manifests-v1');
 const context={URL,Request,Response,console,caches:cacheStorage,fetch:offline,self:{
  registration:{scope:'https://example.org/app/'},location:{origin:'https://example.org'},
  addEventListener:(name,handler)=>{handlers[name]=handler},skipWaiting:async()=>{},clients:{claim:async()=>{}}
 }};
 vm.runInNewContext(readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),context);
 let pending;
 handlers.install({waitUntil:p=>{pending=p}});await pending;
 handlers.activate({waitUntil:p=>{pending=p}});await pending;
 assert.equal(cacheStorage.stores.has('deen-one-shell-old'),false);
 assert.equal(cacheStorage.stores.has('deen-mushaf-pages-v1'),true);
 assert.equal(cacheStorage.stores.has('deen-mushaf-manifests-v1'),true);
 let response;
 handlers.fetch({request:new Request('https://example.org/app/mushaf.mjs'),respondWith:p=>{response=p},waitUntil:()=>{}});
 assert.equal(await (await response).text(),moduleBody);
});

test('deadline includes a stalled response body',async()=>{
 const fetcher=async(url,{signal})=>({ok:true,arrayBuffer:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 await assert.rejects(loadVerifiedMushafPage(page(),{cacheStorage:null,fetcher,timeoutMs:10}),{name:'TimeoutError'});
});
test('unsafe page paths never trigger a fetch',async()=>{
 let fetched=false;
 for(const image of ['https://example.com/page.webp','mushaf-assets/hafs/../warsh/1.webp','mushaf-assets/hafs/1.svg']){
  await assert.rejects(loadVerifiedMushafPage({...page(),image},{cacheStorage:null,fetcher:async()=>{fetched=true}}));
 }
 assert.equal(fetched,false);
});

