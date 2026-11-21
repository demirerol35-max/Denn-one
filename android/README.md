# Deen One — Android prayer reminders (work in progress)

This directory currently contains a **native Android alarm prototype**, not a buildable Android application. The existing Deen One website remains separate.

## Implemented

- `PrayerAlarms.scheduleDay(context, date, timezone, timings, notificationsEnabled)` schedules five prayer alarms from validated times.
- `PrayerAlarmReceiver` displays a native notification.
- The manifest declares the receiver and notification/exact-alarm permissions.

## Required before Android release

1. Create and configure an Android Gradle app, launcher Activity and web-to-native integration; add AndroidX Core dependency.
2. Obtain `POST_NOTIFICATIONS` runtime permission on Android 13+ and respect denial.
3. Check `AlarmManager.canScheduleExactAlarms()` on Android 12+; guide the user to system settings only after explicit opt-in. Inexact fallback does not guarantee delivery at the precise prayer minute.
4. Transfer the current prayer **date, API timezone, validated times and user notification preference** from the web UI into native code. Reschedule when any of them changes.
5. Store the schedule and restore it after reboot, time/timezone changes and app upgrades; the current receiver does **not** do this.
6. Schedule tomorrow's prayers before today's alarms expire; the current code only schedules one date.
7. Add localized notification titles, tap actions, settings and optional Adhan audio.
8. Test on a physical Android device with the app backgrounded, screen locked, force-stopped, battery saver enabled and after reboot. Android force-stop prevents alarm delivery until the user opens the app again.
9. Add Gradle/Android unit and instrumentation tests. **No APK or Android device test has been performed yet.**

Do not claim that a background notification feature is complete until these steps are implemented and verified.


## WebView → Android prayer schedule bridge (development)

AndroidX WebKit registers `window.DeenOneAndroid` only for the trusted
`https://demirerol35-max.github.io` origin, and accepts main-frame messages.

Example from the trusted Deen One page:

```javascript
window.DeenOneAndroid?.postMessage(JSON.stringify({
  type: "schedule",
  payload: {
    date: "2026-11-21",
    timezone: "Europe/Paris",
    timings: {
      Fajr: "06:12", Dhuhr: "12:24", Asr: "14:43",
      Maghrib: "16:58", Isha: "18:32"
    }
  }
}));
```

`type: "disable"` cancels native alarms. Messages receive an acknowledgement
with `{ "type": "...", "ok": true|false }`. The Android-side coordinator
defaults to notifications **disabled**; schedule messages only persist times
until a separate, consent-based native enable flow is implemented.

**Not production ready:** the web app has not yet been wired to post these
messages; the native enable/permission UI, daily rescheduling, APK compilation
and real-device testing remain outstanding. The host restriction is origin-based,
not path-based, so only trusted content should be hosted on this origin.
