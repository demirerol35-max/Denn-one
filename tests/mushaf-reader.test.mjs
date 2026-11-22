import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../vision.html',import.meta.url),'utf8');
const functionSource=name=>{const start=html.indexOf('function '+name+'(');assert.ok(start>=0);const end=html.indexOf('\n}',start);return html.slice(start,end+2)};
function reader(){
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:''});return nodes.get(id)};
 const context={document:{getElementById:get},mushafReader:{hidden:false},mushafPages:Array(604),mushafPageReady:true,mushafCurrentPage:1,mushafMsg:{textContent:''},renders:0,renderVerifiedMushaf(){context.renders++}};
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
  if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:'',attributes:{},listeners:{},
   addEventListener(type,handler){this.listeners[type]=handler},
   setAttribute(name,value){this.attributes[name]=value},
   removeAttribute(name){delete this[name]},
   decode:async()=>{}
  });
  return nodes.get(id);
 };
 const fixture=edition=>({pages:[{number:1,image:'mushaf-assets/'+edition+'/1.webp'}]});
 const module={EDITIONS:{hafs:{label:'Hafs'},warsh:{label:'Warsh'}},
  loadMushafManifest:async edition=>({manifest:fixture(edition)}),
  loadVerifiedMushafPage:async()=>({bytes:new Uint8Array([1]),fromCache:false}),...moduleOverrides};
 const c={document:{getElementById:get},AbortController,Blob,localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>revoked.push(url)},loadModule:async()=>module};
 vm.createContext(c);
 const start=html.indexOf("const mushafMsg=document.getElementById('mushaf-reader-message')");
 const end=html.indexOf('// Navigation Mushaf :',start);
 vm.runInContext(html.slice(start,end).replaceAll("await import('./mushaf.mjs')","await loadModule()"),c);
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
 assert.equal(get('mushaf-reader-title').textContent,'Warsh');
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


