import test from 'node:test';import assert from 'node:assert/strict';import {validateMushafManifest,nextPage,verifyPageBytes} from '../mushaf.mjs';
const page=(n)=>({number:n,image:'mushaf-assets/hafs/'+n+'.webp',sha256:'a'.repeat(64)});
test('rejects Warsh pages mislabeled Hafs',()=>assert.throws(()=>validateMushafManifest({version:1,edition:'hafs',source:'s',license:'l',reviewed:true,pages:[page(1)]},'warsh')));
test('rejects incomplete Hafs Mushaf',()=>assert.throws(()=>validateMushafManifest({version:1,edition:'hafs',source:'s',license:'l',reviewed:true,pages:[page(1)]},'hafs')));
test('requires editorial review and licensing',()=>assert.throws(()=>validateMushafManifest({version:1,edition:'warsh',source:'s',license:'',reviewed:false,pages:[page(1)]},'warsh')));
test('rejects remote or unverified image paths',()=>assert.throws(()=>validateMushafManifest({version:1,edition:'warsh',source:'s',license:'l',reviewed:true,pages:[{...page(1),image:'https://example.com/1.webp'}]},'warsh')));
test('validates a complete sequential Hafs edition manifest',()=>assert.equal(validateMushafManifest({version:1,edition:'hafs',source:'publisher',license:'permission',reviewed:true,pages:Array.from({length:604},(_,i)=>page(i+1))},'hafs').pages.length,604));
test('RTL page navigation stays within edition bounds',()=>{assert.equal(nextPage(1,604,'previous'),1);assert.equal(nextPage(1,604,'next'),2);assert.equal(nextPage(604,604,'next'),604)});

test('rejects a Warsh page path in a Hafs manifest',()=>assert.throws(()=>validateMushafManifest({version:1,edition:'hafs',source:'publisher',license:'permission',reviewed:true,pages:Array.from({length:604},(_,i)=>i===0?{...page(1),image:'mushaf-assets/warsh/1.webp'}:page(i+1))},'hafs')));
test('verifies actual page bytes against SHA-256',async()=>{const bytes=new TextEncoder().encode('verified-page');const hash=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');assert.equal(await verifyPageBytes(bytes,hex),true);assert.equal(await verifyPageBytes(new TextEncoder().encode('tampered-page'),hex),false)});
