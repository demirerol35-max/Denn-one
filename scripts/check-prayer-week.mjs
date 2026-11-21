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

// A network failure on one future date must not schedule an incomplete week.
sandbox.fetch = async () => { throw new Error('Simulated offline API'); };
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Network errors must not schedule incomplete weeks');

// A changed timezone must never reuse prayer times from another location.
sandbox.fetch = async () => ({
  ok:true, json:async () => ({code:200,data:{
    date:{gregorian:{date:'22-11-2026'}},
    meta:{timezone:'Asia/Istanbul'},
    timings:{Fajr:'05:30',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'}
  }})
});
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Timezone mismatch must not schedule alarms');

// Date arithmetic must survive a leap day and a daylight-saving transition.
sandbox.fetch = async url => {
  const match = new RegExp('([0-9]{2})-([0-9]{2})-([0-9]{4})\\?').exec(url);
  assert.ok(match);
  return {ok:true,json:async () => ({code:200,data:{
    date:{gregorian:{date:match[1]+'-'+match[2]+'-'+match[3]}},
    meta:{timezone:'Europe/Paris'},
    timings:{Fajr:'05:30',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'}
  }})};
};
for (const [date, last] of [
  ['27-02-2028','2028-03-04'],
  ['27-03-2027','2027-04-02']
]) {
  sent.length = 0;
  await sandbox.sendAndroidPrayerWeek({
    params:new URLSearchParams(),endpoint:'timingsByCity',
    firstDay:{...firstDay,date:{gregorian:{date}}},
    timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
  });
  assert.equal(sent.length, 1, 'Expected valid week across calendar boundary');
  assert.equal(sent[0].payload.days[6].date, last);
}

// Reject calendar dates that JavaScript Date would otherwise silently normalize.
for (const impossible of ['31-02-2028','29-02-2027']) {
  sent.length = 0;
  await sandbox.sendAndroidPrayerWeek({
    params:new URLSearchParams(),endpoint:'timingsByCity',
    firstDay:{...firstDay,date:{gregorian:{date:impossible}}},
    timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
  });
  assert.equal(sent.length, 0, 'Impossible Gregorian date must be rejected');
}
// A malformed suffix must not be silently truncated into a valid prayer time.
sent.length = 0;
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',
  firstDay:{...firstDay,timings:{...firstDay.timings,Fajr:'05:30INVALID'}},
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Malformed time suffix must be rejected');

// An API response for the wrong day must never be assigned to a requested date.
sandbox.fetch = async () => ({
  ok:true, json:async () => ({code:200,data:{
    date:{gregorian:{date:'21-11-2026'}},
    meta:{timezone:'Europe/Paris'},
    timings:{Fajr:'05:30',Dhuhr:'12:30',Asr:'15:30',Maghrib:'18:30',Isha:'20:00'}
  }})
});
sent.length = 0;
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 0, 'Wrong-day API response must not schedule alarms');

// A valid timezone abbreviation from AlAdhan remains accepted.
sandbox.fetch = async url => {
  const match = new RegExp('([0-9]{2})-([0-9]{2})-([0-9]{4})\\?').exec(url);
  assert.ok(match);
  return {ok:true,json:async () => ({code:200,data:{
    date:{gregorian:{date:match[1]+'-'+match[2]+'-'+match[3]}},
    meta:{timezone:'Europe/Paris'},
    timings:{Fajr:'05:30 (CET)',Dhuhr:'12:30 (CET)',Asr:'15:30 (CET)',
      Maghrib:'18:30 (CET)',Isha:'20:00 (CET)'}
  }})};
};
sent.length = 0;
await sandbox.sendAndroidPrayerWeek({
  params:new URLSearchParams(),endpoint:'timingsByCity',firstDay,
  timezone:'Europe/Paris',requestId:7,signal:{aborted:false}
});
assert.equal(sent.length, 1, 'Valid timezone suffix must be accepted');
assert.equal(sent[0].payload.days[1].timings.Fajr, '05:30');
console.log('OK: ' + scripts.length + ' inline scripts parse; weekly prayer bridge runtime checks pass.');
