import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {QURAN_API,QURAN_TEXT_CACHE,MAX_SAVED_SURAHS,TRANSLATIONS,validateQuranEdition,validateQuranCatalogue,fetchQuranJSON,createSavedSurah,saveSurahOffline,readSurahOffline,listSavedSurahs,deleteSurahOffline} from '../quran-offline.mjs';

function storage() {
 const data=new Map(),cache={
  async put(key,response){data.set(new URL(key.url||key,'https://example.org/Denn-one/').href,response.clone())},
  async match(key){return data.get(new URL(key.url||key,'https://example.org/Denn-one/').href)?.clone()},
  async delete(key){return data.delete(new URL(key.url||key,'https://example.org/Denn-one/').href)},
  async keys(){return [...data.keys()].map(url=>({url}))}
 };
 return {cache,data,async open(){return cache}};
}
const edition=(surah,identifier,count=4)=>({number:surah,numberOfAyahs:count,englishName:'Test fixture',edition:{identifier,englishName:'Fixture author'},ayahs:Array.from({length:count},(_,i)=>({numberInSurah:i+1,text:'Fixture only — '+identifier+' '+i,audio:'https://cdn.islamic.network/quran/audio/128/ar.alafasy/'+(i+1)+'.mp3'}))});
const record=(surah=112,language='fr')=>createSavedSurah({surah,language,arabic:edition(surah,'ar.alafasy'),transliteration:edition(surah,'en.transliteration'),translation:edition(surah,TRANSLATIONS[language])});

test('explicit save restores exact text and source attribution without downloading audio',async()=>{
 const cacheStorage=storage(),original=record();original.arabic.ayahs[0].text='  نصٌّ تجريبيٌّ  ';
 assert.equal(await readSurahOffline(112,'fr',{cacheStorage}),null);
 await saveSurahOffline(original,{cacheStorage});
 const copy=await readSurahOffline(112,'fr',{cacheStorage});
 assert.deepEqual(copy.record,original);assert.ok(copy.bytes>0);
 assert.equal(copy.record.translation.edition.englishName,'Fixture author');
 assert.equal((await listSavedSurahs({cacheStorage})).length,1);
 assert.equal(cacheStorage.data.size,1,'Only one JSON copy, no audio assets');
});

test('surahs and translation languages remain separate; deleting one preserves the others',async()=>{
 const cacheStorage=storage();
 for(const [n,lang] of [[112,'fr'],[112,'tr'],[113,'fr']])await saveSurahOffline(record(n,lang),{cacheStorage});
 assert.equal((await readSurahOffline(112,'tr',{cacheStorage})).record.translation.edition.identifier,'tr.diyanet');
 assert.equal(await readSurahOffline(112,'de',{cacheStorage}),null);
 await deleteSurahOffline(112,'fr',{cacheStorage});
 assert.equal(await readSurahOffline(112,'fr',{cacheStorage}),null);
 assert.equal((await listSavedSurahs({cacheStorage})).length,2);
});

test('rejects partial, reordered, wrong-surah or wrong-language responses before saving',async()=>{
 const cases=[d=>d.ayahs.pop(),d=>d.ayahs.reverse(),d=>d.number=113,d=>d.numberOfAyahs=7,d=>d.edition.identifier='en.sahih',d=>d.ayahs[0].text=''];
 for(const mutate of cases){const input=record();mutate(input.translation);assert.throws(()=>createSavedSurah(input))}
 const input=record();input.arabic.edition.identifier='ar.warsh';assert.throws(()=>createSavedSurah(input));
 for(const surah of [0,115,1.5,'112'])assert.throws(()=>record(surah));
 for(const language of ['ar','__proto__','constructor'])assert.throws(()=>record(112,language));
});

test('cached corruption and a validly hashed but unsupported record are never displayed',async()=>{
 const cacheStorage=storage(),destination='./quran-offline/surah-112-fr.json';
 await saveSurahOffline(record(),{cacheStorage});
 const envelope=await (await cacheStorage.cache.match(destination)).json();
 envelope.payload=envelope.payload.replace('Fixture only','Changed text');
 await cacheStorage.cache.put(destination,Response.json(envelope));
 assert.equal(await readSurahOffline(112,'fr',{cacheStorage}),null);
 assert.equal((await listSavedSurahs({cacheStorage}))[0].valid,false);
 for(const extra of [{version:2},{source:'https://other.example'},{surah:113},{language:'tr'}]){
  const payload=JSON.stringify({...record(),...extra});
  await cacheStorage.cache.put(destination,Response.json({payload,sha256:createHash('sha256').update(payload).digest('hex')}));
  assert.equal(await readSurahOffline(112,'fr',{cacheStorage}),null);
 }
 await deleteSurahOffline(112,'fr',{cacheStorage});assert.equal(cacheStorage.data.size,0);
});

test('a full library never silently evicts a saved surah, but permits replacing one',async()=>{
 const cacheStorage=storage();
 await Promise.all(Array.from({length:MAX_SAVED_SURAHS},(_,i)=>saveSurahOffline(record(i+1),{cacheStorage})));
 await assert.rejects(saveSurahOffline(record(30),{cacheStorage}),/limit/);
 const updated=record(1);updated.arabic.ayahs[0].text='Updated fixture';
 await saveSurahOffline(updated,{cacheStorage});
 assert.equal((await readSurahOffline(1,'fr',{cacheStorage})).record.arabic.ayahs[0].text,'Updated fixture');
 assert.equal((await listSavedSurahs({cacheStorage})).length,MAX_SAVED_SURAHS);
});

test('a failed write preserves the previous copy and subsequent writes can recover',async()=>{
 const cacheStorage=storage();await saveSurahOffline(record(),{cacheStorage});
 const put=cacheStorage.cache.put;cacheStorage.cache.put=async()=>{throw new DOMException('Full','QuotaExceededError')};
 await assert.rejects(saveSurahOffline(record(),{cacheStorage}),{name:'QuotaExceededError'});
 assert.ok(await readSurahOffline(112,'fr',{cacheStorage}));
 cacheStorage.cache.put=put;await deleteSurahOffline(112,'fr',{cacheStorage});await saveSurahOffline(record(),{cacheStorage});
 assert.ok(await readSurahOffline(112,'fr',{cacheStorage}));
});

test('unavailable storage returns no offline copy and reports save/list failures',async()=>{
 const cacheStorage={async open(){throw Error('Storage blocked')}};
 assert.equal(await readSurahOffline(112,'fr',{cacheStorage}),null);
 await assert.rejects(saveSurahOffline(record(),{cacheStorage}));
 await assert.rejects(listSavedSurahs({cacheStorage}));
});

test('does not retain unexpected fields or unsafe audio URLs',()=>{
 const input=edition(112,'ar.alafasy');input.secret='private';
 for(const audio of ['javascript:alert(1)','http://cdn.islamic.network/test','https://user:pass@cdn.islamic.network/test','https://other.example/test']){
  input.ayahs[0].audio=audio;const clean=validateQuranEdition(input,112,'ar.alafasy');
  assert.equal(clean.ayahs[0].audio,undefined);assert.equal(clean.secret,undefined);
 }
});

test('API requests include the response-body timeout and propagate cancellation',async()=>{
 const fetcher=async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 await assert.rejects(fetchQuranJSON('/meta',{fetcher,timeoutMs:10}),{name:'TimeoutError'});
 const controller=new AbortController();controller.abort();let fetched=false;
 await assert.rejects(fetchQuranJSON('/meta',{signal:controller.signal,fetcher:async()=>{fetched=true}}),{name:'AbortError'});
 assert.equal(fetched,false);
 assert.deepEqual(await fetchQuranJSON('/meta',{fetcher:async url=>{assert.equal(url,QURAN_API+'/meta');return Response.json({code:200,data:{ok:true}})}}),{ok:true});
});

test('catalogue accepts only the complete sequential list and ignores extra fields',()=>{
 const list=Array.from({length:114},(_,i)=>({number:i+1,englishName:'Fixture',name:'اختبار',secret:'ignored'}));
 assert.equal(validateQuranCatalogue(list)[0].secret,undefined);
 assert.throws(()=>validateQuranCatalogue(list.slice(1)));
 list[1].number=1;assert.throws(()=>validateQuranCatalogue(list));
});


test('API path guard permits only supported surahs and text editions',async()=>{
 const calls=[];
 const fetcher=async url=>{calls.push(url);return Response.json({code:200,data:{ok:true}})};
 for(const path of ['/surah/1/ar.alafasy','/surah/114/en.transliteration','/surah/112/fr.hamidullah','/surah/2/tr.diyanet']){
  assert.deepEqual(await fetchQuranJSON(path,{fetcher}),{ok:true});
 }
 assert.equal(calls.length,4);
 for(const path of ['/surah/0/ar.alafasy','/surah/115/ar.alafasy','/surah/1/evil.edition','/surah/1/ar.warsh','/surah/1/fr.hamidullah?extra=1','/surah/001/fr.hamidullah']){
  await assert.rejects(fetchQuranJSON(path,{fetcher}),/Invalid API path/);
 }
 assert.equal(calls.length,4,'Rejected paths must never reach the network');
});
