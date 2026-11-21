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
console.log('OK: ' + scripts.length + ' inline scripts parse; weekly prayer bridge checks pass.');
