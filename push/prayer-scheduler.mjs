// Deen One — pure helpers for a future trusted Web Push scheduler.
// This module does not send notifications or store subscriptions.
export const PRAYERS = Object.freeze(['Fajr','Dhuhr','Asr','Maghrib','Isha']);
const formatterCache = new Map();
function formatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(timeZone, new Intl.DateTimeFormat('en-GB', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
    }));
  }
  return formatterCache.get(timeZone);
}
function localParts(instant, timeZone) {
  return Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant))
    .filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
function localStamp(parts) {
  return [parts.year,parts.month,parts.day].join('-')+'T'+parts.hour+':'+parts.minute;
}
// Convert a local wall-clock prayer time into UTC by searching for matching instants.
// This intentionally rejects missing or ambiguous wall-clock times around DST changes.
export function prayerInstant(localDate, clockTime, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(clockTime))
    throw new RangeError('Invalid prayer date or time');
  // Throws RangeError if timeZone is invalid.
  formatter(timeZone).format(new Date());
  const guess = Date.parse(localDate+'T'+clockTime+':00Z');
  if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0,10)!==localDate)
    throw new RangeError('Invalid calendar date');
  const expected = localDate+'T'+clockTime;
  const matches = [];
  // All modern IANA offsets fall within ±14 hours. Minute granularity is
  // deliberate: prayer schedules are published to the minute.
  for (let delta=-14*60; delta<=14*60; delta++) {
    const candidate = guess + delta*60000;
    if (localStamp(localParts(candidate,timeZone))===expected) matches.push(candidate);
    if (matches.length>1) throw new RangeError('Ambiguous local time (DST overlap)');
  }
  if (matches.length!==1) throw new RangeError('Nonexistent local time (DST gap)');
  return matches[0];
}
export function buildPrayerMessages({date,timeZone,timings,lang='fr'}) {
  if (!timings || typeof timings!=='object') throw new TypeError('Missing timings');
  const language = ['fr','tr','ar','en','de'].includes(lang) ? lang : 'fr';
  return PRAYERS.map(prayer => {
    const raw = timings[prayer];
    const match = typeof raw==='string' && raw.match(/^([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/);
    if (!match) throw new RangeError('Invalid '+prayer+' time');
    const scheduledAt = prayerInstant(date,match[1].padStart(2,'0')+':'+match[2],timeZone);
    return {type:'prayer',prayer,lang:language,scheduledAt};
  });
}
export function deliveryKey(subscriptionId,message) {
  if (typeof subscriptionId!=='string'||!subscriptionId) throw new TypeError('Missing subscription id');
  if (!PRAYERS.includes(message.prayer)||!Number.isSafeInteger(message.scheduledAt))
    throw new TypeError('Invalid prayer message');
  return subscriptionId+'|'+message.prayer+'|'+message.scheduledAt;
}

/**
 * Select due Web Push messages without sending early or excessively late.
 * The caller must persist deliveryKey() atomically before attempting delivery
 * and use a server-side retry/outbox policy for failures.
 */
export function duePrayerMessages(messages, now=Date.now(), graceMs=10*60*1000) {
  if (!Array.isArray(messages) || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(graceMs) || graceMs<0)
    throw new TypeError('Invalid scheduler arguments');
  return messages.filter(message =>
    message && PRAYERS.includes(message.prayer) &&
    Number.isSafeInteger(message.scheduledAt) &&
    message.scheduledAt<=now && now-message.scheduledAt<=graceMs
  );
}
