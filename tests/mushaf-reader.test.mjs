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
