// Deen One — private, portable encrypted progress backup (browser and modern Node).
// Does not upload data, include location, or persist passphrases.
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ITERATIONS=310000;
const VERSION=1;
const ALLOWED=['reading','memorization','routine','preferences'];
function getCrypto(){if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues)throw new Error('Web Crypto unavailable');return globalThis.crypto}
function toBase64(bytes){if(typeof btoa==='function')return btoa(String.fromCharCode(...bytes));return Buffer.from(bytes).toString('base64')}
function fromBase64(value){if(typeof value!=='string'||value.length>2e6||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new Error('Invalid backup encoding');const raw=typeof atob==='function'?atob(value):Buffer.from(value,'base64').toString('binary');return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function selectedProgress(progress){if(!progress||typeof progress!=='object'||Array.isArray(progress))throw new TypeError('Invalid progress');const result={};for(const key of ALLOWED)if(Object.hasOwn(progress,key))result[key]=progress[key];return result}
async function derive(passphrase,salt,usage){const c=getCrypto();const key=await c.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);return c.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,[usage])}
export async function encryptProgress(progress,passphrase){
 if(typeof passphrase!=='string'||passphrase.length<12)throw new Error('Passphrase must contain at least 12 characters');
 const c=getCrypto(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
 const data=encoder.encode(JSON.stringify({version:VERSION,progress:selectedProgress(progress)}));
 if(data.length>500000)throw new Error('Backup too large');
 const key=await derive(passphrase,salt,'encrypt');
 const ciphertext=await c.subtle.encrypt({name:'AES-GCM',iv},key,data);
 return JSON.stringify({format:'deen-one-progress',version:VERSION,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:toBase64(salt),iv:toBase64(iv),data:toBase64(new Uint8Array(ciphertext))});
}
export async function decryptProgress(backup,passphrase){
 if(typeof backup!=='string'||backup.length>1000000||typeof passphrase!=='string')throw new Error('Invalid backup');
 const envelope=JSON.parse(backup);
 if(envelope.format!=='deen-one-progress'||envelope.version!==VERSION||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==ITERATIONS||envelope.cipher!=='AES-256-GCM')throw new Error('Unsupported backup format');
 const salt=fromBase64(envelope.salt),iv=fromBase64(envelope.iv),data=fromBase64(envelope.data);
 if(salt.length!==16||iv.length!==12||data.length>500100)throw new Error('Invalid backup');
 const key=await derive(passphrase,salt,'decrypt');
 const clear=await getCrypto().subtle.decrypt({name:'AES-GCM',iv},key,data);
 const payload=JSON.parse(decoder.decode(clear));
 if(payload.version!==VERSION||!payload.progress||typeof payload.progress!=='object'||Array.isArray(payload.progress))throw new Error('Invalid progress payload');
 return selectedProgress(payload.progress);
}
