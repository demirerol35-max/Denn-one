import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EDITIONS,validateMushafManifest,nextPage,verifyPageBytes} from '../mushaf.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const page = (edition,n) => ({number:n,image:`mushaf-assets/${edition}/page-${n}.webp`,sha256:hash(`page-${n}`)});
const manifest = (edition,count) => ({version:1,edition,source:'Reviewed publisher',license:'Licensed for redistribution',reviewed:true,pages:Array.from({length:count},(_,i)=>page(edition,i+1))});

test('Hafs requires 604 sequential pages',()=>{
 assert.equal(validateMushafManifest(manifest('hafs',604),'hafs').pages.length,604);
 assert.throws(()=>validateMushafManifest(manifest('hafs',603),'hafs'));
});
test('Warsh never accepts Hafs assets or an edition mismatch',()=>{
 assert.throws(()=>validateMushafManifest(manifest('hafs',604),'warsh'));
 const m=manifest('warsh',2);m.pages[0].image='mushaf-assets/hafs/page-1.webp';
 assert.throws(()=>validateMushafManifest(m,'warsh'));
});
test('Reject unreviewed, duplicate, out-of-order or unsafe paths',()=>{
 const unreviewed=manifest('warsh',2);unreviewed.reviewed=false;
 assert.throws(()=>validateMushafManifest(unreviewed,'warsh'));
 const duplicate=manifest('warsh',2);duplicate.pages[1].image=duplicate.pages[0].image;
 assert.throws(()=>validateMushafManifest(duplicate,'warsh'));
 const wrongOrder=manifest('warsh',2);wrongOrder.pages[1].number=3;
 assert.throws(()=>validateMushafManifest(wrongOrder,'warsh'));
 const traversal=manifest('warsh',2);traversal.pages[0].image='mushaf-assets/warsh/../hafs/page-1.webp';
 assert.throws(()=>validateMushafManifest(traversal,'warsh'));
});
test('SHA-256 checks real bytes and rejects a mismatch',async()=>{
 const bytes=new TextEncoder().encode('verified image bytes');
 assert.equal(await verifyPageBytes(bytes,hash(bytes)),true);
 assert.equal(await verifyPageBytes(bytes,hash('other bytes')),false);
 assert.equal(await verifyPageBytes(bytes,'invalid'),false);
});
test('Navigation respects first and last page',()=>{
 assert.equal(nextPage(1,604,'previous'),1);
 assert.equal(nextPage(604,604,'next'),604);
 assert.equal(nextPage(5,604,'next'),6);
 assert.equal(nextPage(5,604,'previous'),4);
});

test('Reject unsupported manifest versions and invalid page controls',()=>{
 const m=manifest('warsh',2);m.version=2;
 assert.throws(()=>validateMushafManifest(m,'warsh'));
 assert.throws(()=>nextPage(0,604,'next'));
 assert.throws(()=>nextPage(1,604,'sideways'));
 assert.throws(()=>nextPage(1,0,'next'));
});
