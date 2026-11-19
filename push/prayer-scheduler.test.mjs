import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prayerInstant,buildPrayerMessages,deliveryKey} from './prayer-scheduler.mjs';

test('Paris winter and summer offsets',()=>{
  assert.equal(new Date(prayerInstant('2026-01-15','12:30','Europe/Paris')).toISOString(),'2026-01-15T11:30:00.000Z');
  assert.equal(new Date(prayerInstant('2026-07-15','12:30','Europe/Paris')).toISOString(),'2026-07-15T10:30:00.000Z');
});
test('Istanbul has UTC+3 all year',()=>{
  assert.equal(new Date(prayerInstant('2026-11-19','12:30','Europe/Istanbul')).toISOString(),'2026-11-19T09:30:00.000Z');
});
test('DST gaps and overlaps are rejected',()=>{
  assert.throws(()=>prayerInstant('2026-03-29','02:30','Europe/Paris'),/Nonexistent/);
  assert.throws(()=>prayerInstant('2026-10-25','02:30','Europe/Paris'),/Ambiguous/);
});
test('five prayer messages have the correct shape and unique delivery keys',()=>{
  const timings={Fajr:'05:30 (CET)',Dhuhr:'12:15',Asr:'15:00',Maghrib:'18:00',Isha:'19:30'};
  const messages=buildPrayerMessages({date:'2026-11-19',timeZone:'Europe/Paris',timings,lang:'tr'});
  assert.equal(messages.length,5);
  assert.deepEqual(messages.map(m=>m.prayer),['Fajr','Dhuhr','Asr','Maghrib','Isha']);
  assert.equal(new Set(messages.map(m=>deliveryKey('device-1',m))).size,5);
  assert.equal(messages[0].lang,'tr');
});
test('bad time, timezone, date are rejected',()=>{
  assert.throws(()=>prayerInstant('2026-02-30','12:00','Europe/Paris'));
  assert.throws(()=>prayerInstant('2026-11-19','25:00','Europe/Paris'));
  assert.throws(()=>prayerInstant('2026-11-19','12:00','Fake/Zone'));
});
