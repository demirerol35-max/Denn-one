import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {encryptProgress,decryptProgress} from './progress-backup.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
test('encrypted backup round-trip excludes unrelated sensitive fields',async()=>{
 const original={reading:{surah:2,ayah:12},memorization:{completed:[1]},routine:{prayers:3},preferences:{lang:'tr'},gps:{latitude:1},pushSubscription:{endpoint:'secret'}};
 const encrypted=await encryptProgress(original,'long-private-phrase-2026');
 assert.equal(encrypted.includes('secret'),false);
 assert.deepEqual(await decryptProgress(encrypted,'long-private-phrase-2026'),{reading:original.reading,memorization:original.memorization,routine:original.routine,preferences:original.preferences});
 await assert.rejects(decryptProgress(encrypted,'wrong-password'));
});
test('reject weak passwords and tampered backups',async()=>{
 await assert.rejects(encryptProgress({reading:{}},'short'));
 const encrypted=await encryptProgress({reading:{ayah:4}},'long-private-phrase-2026');
 const changed=JSON.parse(encrypted);changed.data=changed.data.replace(/^./,changed.data[0]==='A'?'B':'A');
 await assert.rejects(decryptProgress(JSON.stringify(changed),'long-private-phrase-2026'));
});
