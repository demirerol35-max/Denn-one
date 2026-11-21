import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../vision.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'No inline scripts found');
for (const [index, script] of scripts.entries()) {
  new vm.Script(script[1], { filename: 'vision.html inline script #' + index });
}

const start = html.indexOf('async function sendAndroidPrayerWeek');
const end = html.indexOf('async function loadPrayerTimes', start);
assert.ok(start >= 0 && end > start, 'Android weekly schedule bridge is missing');
const weekSource = html.slice(start, end);
assert.ok(!weekSource.includes('\\\\d'), 'Double-escaped digit regex in weekly schedule');
assert.ok(weekSource.includes("type:'scheduleWeek'"), 'Weekly schedule message is missing');
assert.ok(weekSource.includes('Promise.all'), 'Future daily schedules are not fetched in parallel');
assert.match('21-11-2026', /^(\d{2})-(\d{2})-(\d{4})$/, 'Gregorian date regex');
assert.match('05:43', /^([01]?\d|2[0-3]):([0-5]\d)/, 'Prayer time regex');

// Execute the real browser helper with a fake API to verify all seven dates
// and ensure an invalid API response never schedules invented alarms.
const sent = [];
const requests = [];
const sandbox = {
  window: { DeenOneAndroid: { postMessage: value => sent.push(JSON.parse(value)) } },
  prayerRequestId: 7,
  fetch: async url => {
    requests.push(url);
    const match = new RegExp('([0-9]{2})-([0-9]{2})-([0-9]{4})\\?').exec(url);
    assert.ok(match, 'Expected dated AlAdhan endpoint');
    const date = match[1] + '-' + match[2] + '-' + match[3];
    return { ok: true, json: async () => ({
      code: 200,
      data: {
        date: { gregorian: { date } },
        meta: { timezone: 'Europe/Paris' },
        timings: { Fajr: '05:30', Dhuhr: '12:30', Asr: '15:30',
                   Maghrib: '18:30', Isha: '20:00' }
      }
    }) };
  }
};
vm.createContext(sandbox);
vm.runInContext(weekSource, sandbox);
const firstDay = {
  date: { gregorian: { date: '21-11-2026' } },
  meta: { timezone: 'Europe/Paris' },
  timings: { Fajr: '05:30', Dhuhr: '12:30', Asr: '15:30',
             Maghrib: '18:30', Isha: '20:00' }
};
await sandbox.sendAndroidPrayerWeek({
  params: new URLSearchParams({city:'Paris',country:'France'}),
  endpoint:'timingsByCity',firstDay,timezone:'Europe/Paris',
  requestId:7,signal:{aborted:false}
});
assert.equal(requests.length, 6);
assert.equal(sent.length, 1);
assert.equal(sent[0].type, 'scheduleWeek');
assert.equal(sent[0].payload.days.length, 7);
assert.equal(sent[0].payload.days[0].date, '2026-11-21');
assert.equal(sent[0].payload.days[6].date, '2026-11-27');
assert.equal(sent[0].payload.days[6].timings.Isha, '20:00');
sent.length = 0;
sandbox.prayerRequestId = 8;
await sandbox.sendAndroidPrayerWeek({
  params: new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Stale requests must not schedule alarms');
sandbox.prayerRequestId = 7;
sandbox.fetch = async () => ({
  ok:true, json:async () => ({ code:200, data:{
    date:{gregorian:{date:'22-11-2026'}},
    meta:{timezone:'Europe/Paris'},
    timings:{Fajr:'25:99',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'}
  } })
});
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Invalid API times must not schedule alarms');
console.log('OK: ' + scripts.length + ' inline scripts parse; weekly prayer bridge runtime checks pass.');
