// Prepare review artifacts only. This command never activates an edition in Deen One.
import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export const RASTER_WIDTH=1400;
const EDITIONS=new Set(['hafs','warsh']);
const NOTICE_PATHS=['LICENSE','NOTICE.md','LICENSES/CC-BY-4.0.txt'];
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlobSha1=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
export function validateSourceLock(lock,edition){
 if(!EDITIONS.has(edition)||lock?.version!==1||lock.repository!=='quran-ws/quran-svg'||!/^[a-f0-9]{40}$/.test(lock.commit))throw Error('Invalid source lock');
 const selected=lock.editions?.[edition];
 if(selected?.expectedPages!==604||selected.pages?.length!==604)throw Error('A complete 604-page source edition is required');
 selected.pages.forEach((page,i)=>{
  if(page.number!==i+1||page.file!==String(i+1).padStart(3,'0')+'.svg'||!/^[a-f0-9]{40}$/.test(page.gitBlobSha1)||!Number.isSafeInteger(page.size)||page.size<1)throw Error('Invalid source page '+(i+1));
 });
 if(lock.notices?.length!==NOTICE_PATHS.length||!NOTICE_PATHS.every((path,i)=>lock.notices[i]?.path===path&&/^[a-f0-9]{40}$/.test(lock.notices[i].gitBlobSha1)&&Number.isSafeInteger(lock.notices[i].size)&&lock.notices[i].size>0))throw Error('Source notices are required');
 return selected;
}
export function verifySourceBytes(bytes,entry){
 if(bytes.length!==entry.size||gitBlobSha1(bytes)!==entry.gitBlobSha1)throw Error('Source bytes differ from the pinned Git blob');
 return sha256(bytes);
}
export function inspectSourceSvg(bytes,sax){
 const parser=sax.parser(true),allowed=new Set(['svg','g','path']);
 let roots=0,paths=0,viewBox=null;
 parser.ondoctype=()=>{throw Error('DOCTYPE is not allowed')};
 parser.onprocessinginstruction=pi=>{if(pi.name!=='xml')throw Error('Processing instruction is not allowed')};
 parser.oncdata=()=>{throw Error('CDATA is not allowed')};
 parser.ontext=value=>{if(value.trim())throw Error('Font-dependent text is not allowed')};
 parser.onopentag=node=>{
  if(!allowed.has(node.name))throw Error('Unsupported SVG element: '+node.name);
  for(const [name,value] of Object.entries(node.attributes)){
   if(/^(?:on|href$|xlink:href$|src$)/i.test(name)||/url\s*\(/i.test(value))throw Error('Active content or resource reference is not allowed');
  }
  if(node.name==='svg'){
   roots++;
   if(roots!==1||node.attributes.xmlns!=='http://www.w3.org/2000/svg')throw Error('Invalid SVG root');
   viewBox=String(node.attributes.viewBox||'').trim().split(/[\s,]+/).map(Number);
   if(viewBox.length!==4||!viewBox.every(Number.isFinite)||viewBox[2]!==345||viewBox[3]!==550)throw Error('Unexpected page viewBox');
  }
  if(node.name==='path'&&node.attributes.d)paths++;
 };
 parser.write(bytes.toString('utf8')).close();
 if(roots!==1||paths<1)throw Error('Empty source page');
 return {viewBox,paths};
}
export async function renderSourcePage(bytes,{sharp,sax}){
 const source=inspectSourceSvg(bytes,sax);
 // Keep the complete original viewBox. No trimming, font replacement or text rewriting.
 const {data,info}=await sharp(bytes,{density:144,limitInputPixels:20_000_000})
  .resize({width:RASTER_WIDTH}).flatten({background:'#fffdf4'}).png({compressionLevel:9})
  .toBuffer({resolveWithObject:true});
 if(info.width!==RASTER_WIDTH||Math.abs(info.height-RASTER_WIDTH*550/345)>1)throw Error('Unexpected raster dimensions');
 const stats=await sharp(data).stats();
 if(!stats.channels.some(channel=>channel.min!==channel.max))throw Error('Blank rendered page');
 return {bytes:data,width:info.width,height:info.height,source};
}
async function safeRead(root,path){
 const file=await realpath(join(root,path)),rel=relative(root,file);
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('Source path escapes its directory');
 return readFile(file);
}
export function reviewHtml(edition){
 if(!EDITIONS.has(edition))throw Error('Unknown edition');
 const label=edition==='hafs'?'Hafs':'Warsh';
 return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deen One · contrôle ${label}</title>
<style>body{margin:0;background:#20382e;color:#fff;font:16px system-ui}header{padding:16px;text-align:center;position:sticky;top:0;background:#20382e}button,input{padding:10px;margin:4px;font:inherit}input{width:80px}main{max-width:900px;margin:auto;padding:10px}img{display:block;width:100%;height:auto;background:#fffdf4;border:3px double #bda363;box-sizing:border-box}.note{font-size:14px}a{color:#e8d6a8}</style>
<header><strong>Deen One · ${label} · contrôle éditorial en attente</strong><div><button id="previous">→ Précédente</button><label>Page <input id="page" type="number" min="1" max="604" step="1" value="1"></label><button id="go">Afficher</button><button id="next">Suivante ←</button></div><p id="status" aria-live="polite"></p></header>
<main><img id="image" alt=""><p class="note">Images préparées pour examen ; cette visionneuse ne déclare aucune validation éditoriale. Source : Quran.ws, édition KFQC. Texte et mise en page non réécrits. Consulter <a href="SOURCE/NOTICE.md">les conditions et attributions</a> et <a href="mushaf-assets/${edition}/manifest.json">le manifeste</a>.</p></main>
<script>let current=1;const image=document.getElementById('image'),input=document.getElementById('page'),status=document.getElementById('status');function show(n){if(!Number.isInteger(n)||n<1||n>604)return;current=n;input.value=n;status.textContent='Page '+n+' / 604 · contrôle éditorial en attente';image.alt='${label} · page '+n;image.src='mushaf-assets/${edition}/'+String(n).padStart(3,'0')+'.png';document.getElementById('previous').disabled=n===1;document.getElementById('next').disabled=n===604}document.getElementById('previous').onclick=()=>show(current-1);document.getElementById('next').onclick=()=>show(current+1);document.getElementById('go').onclick=()=>show(Number(input.value));input.onkeydown=e=>{if(e.key==='Enter')show(Number(input.value))};document.addEventListener('keydown',e=>{if(e.target===input)return;if(e.key==='ArrowLeft'){e.preventDefault();show(current+1)}if(e.key==='ArrowRight'){e.preventDefault();show(current-1)}});image.onerror=()=>{status.textContent='Image indisponible · page '+current};show(1);</script></html>`;
}
export async function prepareEdition({sourceDir,outputDir,edition,lock,render,progress=()=>{}}){
 const selected=validateSourceLock(lock,edition);
 const root=await realpath(sourceDir),out=resolve(outputDir);
 const overlap=relative(root,out),reverse=relative(out,root);
 if(!overlap||(!overlap.startsWith('..')&&!isAbsolute(overlap))||(!reverse.startsWith('..')&&!isAbsolute(reverse)))throw Error('Source and output directories must be separate');
 // A failed run is never mistaken for a complete, publishable edition.
 await mkdir(out,{recursive:false});
 const pageRoot=join('mushafs',edition,'kfqc','svg');
 const names=await readdir(join(root,pageRoot));
 const numeric=names.filter(name=>/^\d{3}\.svg$/.test(name)).sort();
 if(numeric.length!==604||numeric.some((name,i)=>name!==selected.pages[i].file))throw Error('Missing or extra numbered source pages');
 for(const entry of selected.pages)verifySourceBytes(await safeRead(root,join(pageRoot,entry.file)),entry);
 for(const entry of lock.notices)verifySourceBytes(await safeRead(root,entry.path),entry);
 const destination=join(out,'mushaf-assets',edition);await mkdir(destination,{recursive:true});
 const pages=[];
 for(const entry of selected.pages){
  const original=await safeRead(root,join(pageRoot,entry.file)),sourceSha256=verifySourceBytes(original,entry);
  const raster=await render(original);
  const image='mushaf-assets/'+edition+'/'+String(entry.number).padStart(3,'0')+'.png';
  await writeFile(join(out,image),raster.bytes,{flag:'wx'});
  pages.push({number:entry.number,image,sha256:sha256(raster.bytes),sourceSha256,sourceGitBlob:entry.gitBlobSha1,width:raster.width,height:raster.height});
  progress(entry.number);
 }
 for(const entry of lock.notices){
  const target=join(out,'SOURCE',entry.path);await mkdir(dirname(target),{recursive:true});
  await writeFile(target,await safeRead(root,entry.path),{flag:'wx'});
 }
 const manifest={version:1,edition,source:'Quran.ws / KFQC · '+lock.release+' · '+lock.commit,license:'KFQC digital usage terms; Quran.ws metadata CC BY 4.0. See SOURCE/NOTICE.md.',reviewed:false,reviewStatus:'pending',sourceRepository:lock.repository,sourceCommit:lock.commit,pages};
 // Write the manifest last; an interrupted conversion cannot expose a partial edition.
 await writeFile(join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await writeFile(join(out,'review.html'),reviewHtml(edition),{flag:'wx'});
 await writeFile(join(out,'report.json'),JSON.stringify({edition,sourceCommit:lock.commit,pageCount:pages.length,reviewed:false,manifestSha256:sha256(Buffer.from(JSON.stringify(manifest,null,2)+'\n'))},null,2)+'\n',{flag:'wx'});
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [sourceDir,outputDir,edition]=process.argv.slice(2);
  if(!sourceDir||!outputDir||!EDITIONS.has(edition))throw Error('Usage: node scripts/prepare-mushaf.mjs SOURCE_DIR NEW_OUTPUT_DIR hafs|warsh');
  const lock=JSON.parse(await readFile(new URL('../data/mushaf-source-lock.json',import.meta.url),'utf8'));
  const sharp=require(process.env.MUSHAF_SHARP_MODULE||'sharp'),sax=require(process.env.MUSHAF_SAX_MODULE||'sax');
  const manifest=await prepareEdition({sourceDir,outputDir,edition,lock,render:bytes=>renderSourcePage(bytes,{sharp,sax}),progress:n=>{if(n%50===0||n===604)console.log(edition+': '+n+'/604')}});
  console.log(JSON.stringify({edition,pages:manifest.pages.length,sourceCommit:lock.commit,reviewed:false}));
 }catch(error){console.error(error.message);process.exitCode=1}
}

