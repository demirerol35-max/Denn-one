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
 return Object.freeze({edition,source:manifest.source,license:manifest.license,pages:manifest.pages.map(p=>Object.freeze({...p}))});
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
