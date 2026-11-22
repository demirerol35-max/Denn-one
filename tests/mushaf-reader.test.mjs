import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mushafSpread,turnMushafSpread} from '../mushaf.mjs';
const html=readFileSync(new URL('../vision.html',import.meta.url),'utf8');
const functionSource=name=>{const start=html.indexOf('function '+name+'(');assert.ok(start>=0);const end=html.indexOf('\n}',start);return html.slice(start,end+2)};
function reader(){
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:''});return nodes.get(id)};
 const context={document:{getElementById:get},mushafSetMessage:()=>{},mushafReader:{hidden:false},mushafPages:Array(604),mushafPageReady:true,mushafCurrentPage:1,mushafIsDouble:()=>false,mushafModule:{mushafSpread,turnMushafSpread},mushafMsg:{textContent:''},renders:0,renderVerifiedMushaf(){context.renders++}};
 vm.createContext(context);
 vm.runInContext(functionSource('jumpMushafPage')+'\n'+functionSource('turnMushafPage'),context);
 return {context,get};
}
test('jump accepts only whole page numbers inside this edition',()=>{
 const {context:c,get}=reader();
 for(const value of ['','0','-1','2.5','1e2','605']){get('mushaf-jump').value=value;c.jumpMushafPage();assert.equal(c.renders,0)}
 get('mushaf-jump').value='604';c.jumpMushafPage();assert.equal(c.mushafCurrentPage,604);assert.equal(c.renders,1);
});
test('failed page can be bypassed with direct page selection',()=>{
 const {context:c,get}=reader();c.mushafPageReady=false;get('mushaf-jump').value='12';c.jumpMushafPage();assert.equal(c.mushafCurrentPage,12);assert.equal(c.renders,1);
});
test('RTL turns respect boundaries and stop while Coran tab is hidden',()=>{
 const {context:c,get}=reader();c.turnMushafPage('previous');assert.equal(c.renders,0);
 c.turnMushafPage('next');assert.equal(c.mushafCurrentPage,2);
 get('quran').hidden=true;c.turnMushafPage('next');assert.equal(c.mushafCurrentPage,2);
 get('quran').hidden=false;c.mushafPageReady=false;c.turnMushafPage('next');assert.equal(c.mushafCurrentPage,2);
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
function ui(moduleOverrides={}){
 const nodes=new Map(),saved=new Map(),revoked=[];
 const get=id=>{
  if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:'',style:{},attributes:{},listeners:{},children:[],
   replaceChildren(...children){this.children=children},
   append(child){this.children.push(child)},
   addEventListener(type,handler){this.listeners[type]=handler},
   setAttribute(name,value){this.attributes[name]=value},
   getAttribute(name){return this.attributes[name]??null},
   removeAttribute(name){delete this[name];delete this.attributes[name]},
   decode:async()=>{}
  });
  return nodes.get(id);
 };
 const fixture=edition=>({pages:[{number:1,image:'mushaf-assets/'+edition+'/1.webp'}]});
 const module={mushafSpread,turnMushafSpread,EDITIONS:{hafs:{label:'Hafs'},warsh:{label:'Warsh'}},
  loadMushafManifest:async edition=>({manifest:fixture(edition)}),
  loadVerifiedMushafPage:async()=>({bytes:new Uint8Array([1]),fromCache:false}),...moduleOverrides};
 const c={document:{getElementById:get,querySelectorAll:()=>[],addEventListener:()=>{},createElement:()=>({})},queueMicrotask,AbortController,Blob,localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked.push(url)},loadModule:async()=>module};
 vm.createContext(c);
 const start=html.indexOf("const mushafMsg=document.getElementById('mushaf-reader-message')");
 const end=html.indexOf('// Navigation Mushaf :',start);
 vm.runInContext(html.slice(start,end).replaceAll("await import('./mushaf.mjs?v=book-20261122')","await loadModule()"),c);
 return {c,get,saved,revoked,module};
}
test('switching edition cancels the previous manifest and ignores its late result',async()=>{
 const pending=deferred();let oldSignal;
 const {c,get,saved}=ui({loadMushafManifest:async(edition,{signal})=>{
  if(edition==='hafs'){oldSignal=signal;return pending.promise}
  return {manifest:{pages:[{number:1,image:'mushaf-assets/warsh/1.webp'}]}};
 }});
 const old=c.openVerifiedMushaf('hafs');await new Promise(resolve=>setImmediate(resolve));
 await c.openVerifiedMushaf('warsh');
 assert.equal(oldSignal.aborted,true);
 pending.resolve({manifest:{pages:[{number:1,image:'mushaf-assets/hafs/1.webp'}]}});await old;
 assert.equal(get('mushaf-reader-title').textContent,'Warsh d’après Nâfi‘');
 assert.equal(saved.get('deen-mushaf-page-warsh'),'1');
 assert.equal(saved.has('deen-mushaf-page-hafs'),false);
});
test('closing during page verification cancels loading and never saves the stale page',async()=>{
 const pending=deferred();let pageSignal;
 const {c,get,saved}=ui({loadVerifiedMushafPage:async(page,{signal})=>{pageSignal=signal;return pending.promise}});
 const opening=c.openVerifiedMushaf('hafs');await new Promise(resolve=>setImmediate(resolve));
 get('mushaf-close').listeners.click();assert.equal(pageSignal.aborted,true);
 pending.resolve({bytes:new Uint8Array([1]),fromCache:false});await opening;
 assert.equal(get('mushaf-reader').hidden,true);assert.equal(saved.size,0);
 assert.equal(get('mushaf-page-image').src,undefined);
});
test('an undecodable image releases its URL and can be retried',async()=>{
 const {c,get,saved,revoked}=ui();
 get('mushaf-page-image').decode=async()=>{throw Error('Invalid image')};
 await c.openVerifiedMushaf('hafs');
 assert.equal(get('mushaf-retry').hidden,false);
 assert.equal(get('mushaf-next').disabled,true);
 assert.equal(saved.size,0);assert.equal(revoked.length,1);
 assert.equal(get('mushaf-reader').attributes['aria-busy'],'false');
 get('mushaf-page-image').decode=async()=>{};
 await c.renderVerifiedMushaf();
 assert.equal(get('mushaf-retry').hidden,true);
 assert.equal(saved.get('deen-mushaf-page-hafs'),'1');
});

test('double-page spreads preserve the requested even page and stay bounded',()=>{
 assert.deepEqual(mushafSpread(1,604,true),[1,2]);
 assert.deepEqual(mushafSpread(300,604,true),[299,300]);
 assert.deepEqual(mushafSpread(604,604,true),[603,604]);
 assert.deepEqual(mushafSpread(5,5,true),[5]);
 assert.deepEqual(mushafSpread(300,604,false),[300]);
 assert.equal(turnMushafSpread(300,604,'next',true),301);
 assert.equal(turnMushafSpread(300,604,'previous',true),297);
 assert.equal(turnMushafSpread(604,604,'next',true),604);
 assert.equal(turnMushafSpread(1,604,'previous',true),1);
 for(const args of [[0,604,true],[1,0,true],[1,604,'double']])assert.throws(()=>mushafSpread(...args));
});
test('a double-page load fails as a unit when one page fails verification',async()=>{
 const {c,get,saved}=ui({
  loadMushafManifest:async()=>({manifest:{pages:[{number:1,image:'mushaf-assets/hafs/1.webp'},{number:2,image:'mushaf-assets/hafs/2.webp'}]}}),
  loadVerifiedMushafPage:async page=>{if(page.number===2)throw Error('Hash mismatch');return {bytes:new Uint8Array([1]),fromCache:false}}
 });
 get('mushaf-layout').value='double';get('mushaf-layout').listeners.change({target:get('mushaf-layout')});
 await c.openVerifiedMushaf('hafs');
 assert.equal(get('mushaf-retry').hidden,false);assert.equal(saved.has('deen-mushaf-page-hafs'),false);
 assert.equal(get('mushaf-page-image').src,undefined);assert.equal(get('mushaf-page-image-second').src,undefined);
});
test('both verified pages appear together and zoom is bounded',async()=>{
 const {c,get,saved}=ui({
  loadMushafManifest:async()=>({manifest:{pages:[{number:1,image:'mushaf-assets/hafs/1.webp'},{number:2,image:'mushaf-assets/hafs/2.webp'}]}})
 });
 get('mushaf-layout').value='double';get('mushaf-layout').listeners.change({target:get('mushaf-layout')});
 await c.openVerifiedMushaf('hafs');
 assert.equal(get('mushaf-page-image').alt,'Hafs · page 1');
 assert.equal(get('mushaf-page-image-second').alt,'Hafs · page 2');
 assert.equal(get('mushaf-counter').textContent,'Pages 1–2 / 2');
 assert.equal(get('mushaf-reader').attributes['aria-busy'],'false');
 assert.equal(saved.get('deen-mushaf-page-hafs'),'1');
 for(let n=0;n<10;n++)get('mushaf-zoom-in').listeners.click();
 assert.equal(get('mushaf-page-spread').style.width,'200%');assert.equal(get('mushaf-zoom-in').disabled,true);
 get('mushaf-zoom-reset').listeners.click();
 assert.equal(get('mushaf-page-spread').style.width,'100%');assert.equal(get('mushaf-zoom-out').disabled,true);
});

test('all reader languages preserve template parameters and live errors follow language changes',async()=>{
 const {c,get,saved}=ui();
 const dictionary=vm.runInContext('mushafTranslations',c),keys=Object.keys(dictionary.fr).sort();
 const parameters=text=>(text.match(/\{\w+\}/g)||[]).sort();
 for(const language of ['en','tr','de','ar']){
  assert.deepEqual(Object.keys(dictionary[language]).sort(),keys);
  for(const key of keys)assert.deepEqual(parameters(dictionary[language][key]),parameters(dictionary.fr[key]));
 }
 await c.openVerifiedMushaf('warsh');
 get('mushaf-jump').value='0';c.jumpMushafPage();
 saved.set('deen-app-language','tr');c.refreshMushafLanguage();
 assert.equal(get('mushaf-reader-message').textContent,'1 ile 1 arasında bir sayfa seç.');
 assert.equal(get('mushaf-page-image').alt,'Verş · sayfa 1');
 assert.equal(get('mushaf-reader-title').textContent,'Nâfi‘den Verş');
 saved.set('deen-app-language','ar');c.refreshMushafLanguage();
 assert.equal(get('mushaf-page-image').alt,'ورش · الصفحة 1');
 get('mushaf-fullscreen').listeners.click();
 assert.equal(get('mushaf-reader-message').textContent,dictionary.ar.fullscreenUnavailable);
});

test('page bookmarks are saved separately by edition and rejected when the source changes',async()=>{
 const {c,get,saved,module}=ui({loadMushafManifest:async edition=>({manifest:{source:'Source '+edition,pages:[{number:1,image:'mushaf-assets/'+edition+'/1.webp'}]}})});
 await c.openVerifiedMushaf('hafs');c.toggleMushafBookmark();
 assert.deepEqual(JSON.parse(saved.get('deen-mushaf-bookmarks-hafs')).pages,[1]);
 await c.openVerifiedMushaf('warsh');
 assert.equal(get('mushaf-bookmark-toggle').attributes['aria-pressed'],'false');
 c.toggleMushafBookmark();
 assert.deepEqual(JSON.parse(saved.get('deen-mushaf-bookmarks-warsh')).pages,[1]);
 await c.openVerifiedMushaf('hafs');
 assert.equal(get('mushaf-bookmark-toggle').attributes['aria-pressed'],'true');
 module.loadMushafManifest=async()=>({manifest:{source:'Revised source',pages:[{number:1,image:'mushaf-assets/hafs/1.webp'}]}});
 await c.openVerifiedMushaf('hafs');assert.equal(c.readMushafBookmarks().length,0);
});
test('bookmark storage filters corrupt, repeated and out-of-range page numbers',async()=>{
 const {c,saved}=ui({loadMushafManifest:async()=>({manifest:{source:'Source',pages:[{number:1,image:'mushaf-assets/hafs/1.webp'},{number:2,image:'mushaf-assets/hafs/2.webp'}]}})});
 await c.openVerifiedMushaf('hafs');
 saved.set('deen-mushaf-bookmarks-hafs',JSON.stringify({version:1,source:'Source',pages:[2,1,2,0,-1,3,1.2,'1',null]}));
 assert.deepEqual(Array.from(c.readMushafBookmarks()),[1,2]);
 saved.set('deen-mushaf-bookmarks-hafs','broken JSON');assert.equal(c.readMushafBookmarks().length,0);
 saved.delete('deen-mushaf-bookmarks-hafs');c.localStorage.setItem=()=>{throw Error('Storage unavailable')};
 c.toggleMushafBookmark();assert.equal(saved.has('deen-mushaf-bookmarks-hafs'),false);
 assert.equal(c.document.getElementById('mushaf-reader-message').textContent,'Impossible d’enregistrer ce favori sur cet appareil.');
});
test('an unverified page cannot become a bookmark',async()=>{
 const pending=deferred();
 const {c,saved}=ui({loadMushafManifest:async()=>({manifest:{source:'Source',pages:[{number:1,image:'mushaf-assets/hafs/1.webp'}]}}),loadVerifiedMushafPage:async()=>pending.promise});
 const opening=c.openVerifiedMushaf('hafs');await new Promise(resolve=>setImmediate(resolve));
 c.toggleMushafBookmark();assert.equal(saved.has('deen-mushaf-bookmarks-hafs'),false);
 pending.resolve({bytes:new Uint8Array([1]),fromCache:false});await opening;
 c.toggleMushafBookmark();assert.deepEqual(JSON.parse(saved.get('deen-mushaf-bookmarks-hafs')).pages,[1]);
});





