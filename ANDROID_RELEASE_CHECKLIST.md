# Deen One — Android release and prayer notification checklist

Status: **not yet validated on a native Android build**. The repository currently documents a GitHub Pages/PWA deployment. Do not treat green browser tests as proof that an APK can be built or that prayer alarms work after the app is closed.

## Current web implementation
- `service-worker.js` receives **push events**, validates prayer names and a limited delivery window, suppresses duplicate notifications, and routes notification clicks to `vision.html#prayer`.
- The service worker **does not schedule** future prayers or create push subscriptions. It cannot, by itself, wake an Android device at a locally scheduled prayer time.
- The web manifest uses an SVG icon. Native Android notification small icons require a suitable monochrome Android drawable and should be tested on a device.

## Choose an Android delivery path
1. **Native Android wrapper (recommended for offline local prayer alarms):** identify or add the Android project/build workflow first. Use Android AlarmManager (with appropriate exact-alarm permission or user-facing fallback), a BroadcastReceiver, and a boot/timezone-change rescheduling path. Handle Android 13+ `POST_NOTIFICATIONS` permission. Request exact-alarm access only if required and eligible under current Android/Play policies. Avoid assuming a generic WebView's service worker schedules native alarms.
2. **Web Push:** implement an authenticated subscription flow, secure server-side scheduling and VAPID delivery. This requires a network connection and delivery timing may vary. Do not put VAPID private keys or push credentials in the public repository.

## Device acceptance checklist
- [ ] Locate the actual APK build source and CI workflow, and record the build artifact/version.
- [ ] Install a fresh APK and upgrade an existing APK without losing settings.
- [ ] Confirm notification permission prompt and settings on Android 13+.
- [ ] Verify all five prayers, local time zone, daylight-saving changes and manual/GPS location.
- [ ] Confirm one notification per prayer; no duplicate after reopen, refresh, or reboot.
- [ ] Test app in foreground, background, swiped away, and after device reboot.
- [ ] Test battery restrictions/Doze; document Android's force-stop limitation (force-stopped apps cannot generally receive scheduled background delivery until reopened).
- [ ] Verify notification tap opens Prayer, correct logo/small icon, vibration/sound preferences and silent mode.
- [ ] Verify the Quran remains available offline after an app update.
- [ ] Check sign-in persistence separately in browser and installed APK.

## Release gate
Keep the PR in draft until the Android build source is identified, the device tests are performed, and the push/local alarm delivery mechanism is confirmed. Green web CI alone is not a release gate for native Android.
