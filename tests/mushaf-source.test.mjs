import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,readdir} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {validateSourceLock,verifySourceBytes,gitBlobSha1,sha256,inspectSourceSvg,renderSourcePage,prepareEdition,reviewHtml,RASTER_WIDTH} from '../scripts/prepare-mushaf.mjs';
import {validateMushafManifest} from '../mushaf.mjs';
const require=createRequire(import.meta.url),sharp=require(process.env.MUSHAF_SHARP_MODULE||'sharp'),sax=require(process.env.MUSHAF_SAX_MODULE||'sax');
const source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -200 345 550"><g><path d="M 0 0 L 100 0 L 100 100 Z"/></g></svg>';
const entry=bytes=>({gitBlobSha1:gitBlobSha1(bytes),size:bytes.length});
const actualLock=JSON.parse(await readFile(new URL('../data/mushaf-source-lock.json',import.meta.url),'utf8'));
test('both complete source editions are pinned with separate page hashes',()=>{
 for(const edition of ['hafs','warsh'])assert.equal(validateSourceLock(actualLock,edition).pages.length,604);
 assert.notEqual(actualLock.editions.hafs.pages[0].gitBlobSha1,actualLock.editions.warsh.pages[0].gitBlobSha1);
 for(const change of [
  lock=>{lock.editions.hafs.pages.pop()},
  lock=>{lock.editions.hafs.pages[0].file='../warsh/001.svg'},
  lock=>{lock.notices=[]}
 ]){
  const lock=structuredClone(actualLock);change(lock);assert.throws(()=>validateSourceLock(lock,'hafs'));
 }
 assert.throws(()=>validateSourceLock(actualLock,'unknown'));
});
test('source identity includes Git blob framing and original byte length',()=>{
 const bytes=Buffer.from(source),p=entry(bytes);
 assert.equal(verifySourceBytes(bytes,p),sha256(bytes));
 assert.throws(()=>verifySourceBytes(Buffer.from(source+' '),p));
 assert.throws(()=>verifySourceBytes(bytes,{...p,gitBlobSha1:'a'.repeat(40)}));
});
test('SVG inspection preserves negative page origins and rejects executable or external content',()=>{
 assert.deepEqual(inspectSourceSvg(Buffer.from(source),sax).viewBox,[-50,-200,345,550]);
 const invalid=[
  source.replace('<g>','<script>bad</script><g>'),
  source.replace('<g>','<image href="file:///etc/passwd"/><g>'),
  source.replace('<g>','<text>font-dependent</text><g>'),
  source.replace('<g>','<g onclick="bad()">'),
  source.replace('<g>','<g style="fill:url(https://example.org/ink)">'),
  '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'+source,
  source.replace('345 550','345 100'),
  source.replace('<g>','<foreignObject/><g>')
 ];
 for(const svg of invalid)assert.throws(()=>inspectSourceSvg(Buffer.from(svg),sax));
});
test('real raster conversion keeps the full page shape and visible ink',async()=>{
 const rendered=await renderSourcePage(Buffer.from(source),{sharp,sax});
 const metadata=await sharp(rendered.bytes).metadata();
 assert.equal(metadata.format,'png');assert.equal(metadata.width,RASTER_WIDTH);
 assert.ok(Math.abs(metadata.height-RASTER_WIDTH*550/345)<1);
 const stats=await sharp(rendered.bytes).stats();
 assert.ok(stats.channels[0].min<100);assert.ok(stats.channels[0].max>200);
 await assert.rejects(renderSourcePage(Buffer.from(source.replace('M 0 0 L 100 0 L 100 100 Z','M 0 0')),{sharp,sax}),/Blank/);
});
test('complete conversion writes reproducible hashes and never marks an edition reviewed',async t=>{
 const root=await mkdtemp(join(tmpdir(),'deen-mushaf-source-'));
 t.after(async()=>{
  if(dirname(root)!==resolve(tmpdir())||!basename(root).startsWith('deen-mushaf-source-'))throw Error('Unsafe test cleanup target');
  await rm(root,{recursive:true,force:true});
 });
 const upstream=join(root,'upstream'),output=join(root,'review');
 const folder=join(upstream,'mushafs','hafs','kfqc','svg');
 await mkdir(folder,{recursive:true});
 const bytes=Buffer.from(source),p=entry(bytes),lock=structuredClone(actualLock);
 for(const page of lock.editions.hafs.pages){
  Object.assign(page,p);await writeFile(join(folder,page.file),bytes);
 }
 for(const notice of lock.notices){
  const text=Buffer.from('Synthetic test notice '+notice.path);
  Object.assign(notice,entry(text));
  await mkdir(dirname(join(upstream,notice.path)),{recursive:true});await writeFile(join(upstream,notice.path),text);
 }
 const raster=await renderSourcePage(bytes,{sharp,sax});
 let count=0;
 const manifest=await prepareEdition({sourceDir:upstream,outputDir:output,edition:'hafs',lock,render:async()=>{count++;return raster}});
 assert.equal(count,604);assert.equal(manifest.reviewed,false);assert.equal(manifest.pages.length,604);
 assert.throws(()=>validateMushafManifest(manifest,'hafs'));
 for(const n of [1,300,604]){
  const page=manifest.pages[n-1],written=await readFile(join(output,page.image));
  assert.equal(sha256(written),page.sha256);assert.equal(page.sourceSha256,sha256(bytes));
 }
 assert.equal((await readdir(join(output,'mushaf-assets','hafs'))).length,605);
 await assert.rejects(prepareEdition({sourceDir:upstream,outputDir:output,edition:'hafs',lock,render:async()=>raster}),/EEXIST/);
 await writeFile(join(folder,'001.svg'),Buffer.from('tampered'));
 const failed=join(root,'failed');
 await assert.rejects(prepareEdition({sourceDir:upstream,outputDir:failed,edition:'hafs',lock,render:async()=>raster}),/Source bytes/);
 await assert.rejects(readFile(join(failed,'mushaf-assets','hafs','manifest.json')));
 await assert.rejects(prepareEdition({sourceDir:upstream,outputDir:join(upstream,'output'),edition:'hafs',lock,render:async()=>raster}),/separate/);
});
test('review viewer selects only its edition and clamps navigation to the source page count',()=>{
 for(const edition of ['hafs','warsh']){
  const html=reviewHtml(edition),nodes=new Map(),listeners={};
  const get=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document:{getElementById:get,addEventListener:(name,fn)=>{listeners[name]=fn}}});
  assert.equal(get('image').src,'mushaf-assets/'+edition+'/001.png');
  get('page').value='604';get('go').onclick();get('next').onclick();
  assert.equal(get('image').src,'mushaf-assets/'+edition+'/604.png');
  get('page').value='2.5';get('go').onclick();assert.ok(get('image').src.endsWith('/604.png'));
 }
 assert.throws(()=>reviewHtml('untrusted'));
});

