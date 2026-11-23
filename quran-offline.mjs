// Explicit, device-local copies of the classic reader's text editions. No audio files.
export const QURAN_API = 'https://api.alquran.cloud/v1';
export const QURAN_TEXT_CACHE = 'deen-quran-text-v1';
export const TRANSLATIONS = Object.freeze({fr:'fr.hamidullah',en:'en.sahih',tr:'tr.diyanet',de:'de.bubenheim'});
export const MAX_SAVED_SURAHS = 20;
export const MAX_SAVED_BYTES = 12 * 1024 * 1024;
const MAX_RECORD_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
function validSurah(n) { return Number.isInteger(n) && n >= 1 && n <= 114; }
function text(value, max = 200) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function checkAbort(signal) { if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError'); }
function key(surah, language) {
  if (!validSurah(surah) || !Object.hasOwn(TRANSLATIONS, language)) throw Error('Invalid surah or language');
  return `./quran-offline/surah-${surah}-${language}.json`;
}
function entryFromKey(request) {
  const match = new URL(request.url || request, 'https://local.invalid/').pathname.match(/\/quran-offline\/surah-([0-9]+)-(fr|en|tr|de)\.json$/);
  return match && validSurah(Number(match[1])) ? {surah:Number(match[1]),language:match[2]} : null;
}
async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateQuranEdition(data, surah, identifier, expectedCount) {
  if (!validSurah(surah) || !['ar.alafasy','en.transliteration',...Object.values(TRANSLATIONS)].includes(identifier)) throw Error('Invalid edition');
  const count = data?.numberOfAyahs;
  if (data?.number !== surah || data?.edition?.identifier !== identifier || !text(data.englishName) ||
      !text(data.edition.englishName) || !Number.isInteger(count) || count < 1 || count > 286 ||
      (expectedCount !== undefined && count !== expectedCount) || !Array.isArray(data.ayahs) || data.ayahs.length !== count) throw Error('Incomplete or mismatched edition');
  const ayahs = data.ayahs.map((verse, index) => {
    if (verse?.numberInSurah !== index + 1 || !text(verse.text, 20000)) throw Error('Invalid verse sequence');
    // Preserve the text exactly, including spelling and diacritics. Render with textContent.
    const result = {numberInSurah:verse.numberInSurah,text:verse.text};
    if (identifier === 'ar.alafasy' && typeof verse.audio === 'string') {
      try { const url = new URL(verse.audio); if (url.protocol === 'https:' && !url.username && !url.password && url.hostname === 'cdn.islamic.network') result.audio = url.href; } catch {}
    }
    return result;
  });
  return {number:surah,numberOfAyahs:count,englishName:data.englishName,edition:{identifier,englishName:data.edition.englishName},ayahs};
}

export function validateQuranCatalogue(entries) {
  if (!Array.isArray(entries) || entries.length !== 114) throw Error('Invalid catalogue');
  return entries.map((entry, index) => {
    if (entry?.number !== index + 1 || !text(entry.englishName) || !text(entry.name)) throw Error('Invalid catalogue entry');
    return {number:entry.number,englishName:entry.englishName,name:entry.name};
  });
}

export async function fetchQuranJSON(path, {fetcher = globalThis.fetch, signal, timeoutMs = 10000} = {}) {
  if (path !== '/meta') {
    const match = /^\/surah\/([1-9][0-9]{0,2})\/([a-z]+\.[a-z]+)$/.exec(path);
    if (!match || !validSurah(Number(match[1])) ||
        !['ar.alafasy', 'en.transliteration', ...Object.values(TRANSLATIONS)].includes(match[2])) {
      throw Error('Invalid API path');
    }
  }
  checkAbort(signal);
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetcher(QURAN_API + path, {signal:controller.signal});
    if (!response.ok) throw Error('API unavailable');
    const json = await response.json();
    checkAbort(signal);
    if (json?.code !== 200) throw Error('API unavailable');
    return json.data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export function createSavedSurah({surah, language, arabic, transliteration, translation}) {
  key(surah, language);
  const base = validateQuranEdition(arabic, surah, 'ar.alafasy');
  return {version:1,source:QURAN_API,surah,language,arabic:base,
    transliteration:validateQuranEdition(transliteration, surah, 'en.transliteration', base.numberOfAyahs),
    translation:validateQuranEdition(translation, surah, TRANSLATIONS[language], base.numberOfAyahs)};
}

export function savedSurahBytes(record) { return encoder.encode(JSON.stringify(createSavedSurah(record))).length; }

// Serialize writes in this document so quick save/delete clicks cannot overtake each other.
let mutation = Promise.resolve();
function mutate(operation) {
  const next = mutation.then(() => globalThis.navigator?.locks
    ? navigator.locks.request(QURAN_TEXT_CACHE, operation) : operation());
  mutation = next.catch(() => {});
  return next;
}

export function saveSurahOffline(record, {cacheStorage = globalThis.caches} = {}) {
  const validated = createSavedSurah(record);
  return mutate(async () => {
    const payload = JSON.stringify(validated);
    const envelope = JSON.stringify({payload,sha256:await digest(payload)});
    const bytes = encoder.encode(envelope).length;
    if (bytes > MAX_RECORD_BYTES) throw Error('Copy too large');
    const cache = await cacheStorage.open(QURAN_TEXT_CACHE);
    const destination = key(validated.surah, validated.language);
    const existing = await cache.match(destination);
    const requests = (await cache.keys()).filter(entryFromKey);
    if (!existing && requests.length >= MAX_SAVED_SURAHS) throw Error('Copy limit reached');
    let total = bytes;
    for (const request of requests) {
      const entry = entryFromKey(request);
      if (entry.surah === validated.surah && entry.language === validated.language) continue;
      const response = await cache.match(request);
      if (response) total += (await response.arrayBuffer()).byteLength;
    }
    if (total > MAX_SAVED_BYTES) throw Error('Storage limit reached');
    // Cache.put replaces a single entry atomically; failures keep the previous copy.
    await cache.put(destination, new Response(envelope, {headers:{'Content-Type':'application/json'}}));
    return {record:validated,bytes};
  });
}

export async function readSurahOffline(surah, language, {cacheStorage = globalThis.caches} = {}) {
  const destination = key(surah, language);
  let cache, response;
  try { cache = await cacheStorage?.open(QURAN_TEXT_CACHE); response = await cache?.match(destination); } catch { return null; }
  if (!response) return null;
  try {
    const raw = await response.text();
    if (encoder.encode(raw).length > MAX_RECORD_BYTES) return null;
    const envelope = JSON.parse(raw);
    if (typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.sha256) || await digest(envelope.payload) !== envelope.sha256) return null;
    const payload = JSON.parse(envelope.payload);
    if (payload.version !== 1 || payload.source !== QURAN_API || payload.surah !== surah || payload.language !== language) return null;
    return {record:createSavedSurah(payload),bytes:encoder.encode(raw).length};
  } catch { return null; }
}

export async function listSavedSurahs({cacheStorage = globalThis.caches} = {}) {
  const cache = await cacheStorage.open(QURAN_TEXT_CACHE);
  const entries = [];
  for (const request of await cache.keys()) {
    const entry = entryFromKey(request);
    if (!entry) continue;
    const copy = await readSurahOffline(entry.surah, entry.language, {cacheStorage});
    entries.push({...entry,valid:Boolean(copy),name:copy?.record.arabic.englishName || '',bytes:copy?.bytes || 0});
  }
  return entries.sort((a,b) => a.surah - b.surah || a.language.localeCompare(b.language));
}

export function deleteSurahOffline(surah, language, {cacheStorage = globalThis.caches} = {}) {
  const destination = key(surah, language);
  return mutate(async () => (await cacheStorage.open(QURAN_TEXT_CACHE)).delete(destination));
}
