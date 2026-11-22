# Deen One for iOS — initial source scaffold

This directory starts a native SwiftUI/WKWebView iOS application. It is **not yet an installable iOS app**.

## Setup
1. On a Mac, create an Xcode iOS App project named **DeenOne** (SwiftUI, Swift).
2. Add the four Swift files from `DeenOne/` to the app target, replacing the generated app entry point.
3. Set an app icon using the canonical root `deen-one-icon.svg` artwork exported to the required iOS asset sizes.
4. Configure signing with an Apple development team and run on a physical iPhone.

## Work remaining
- Add a tightly origin/path-validated WKScriptMessageHandler bridge for prayer schedules.
- Validate prayer timezone and schedule payloads before calling `PrayerNotifications.schedule`.
- Request notification consent from an explicit user action, not automatically.
- Support restoring and refreshing a rolling notification window, and handle permission denial.
- Bundle offline Quran content, localize native UI, and add test coverage.
- Create an Xcode project and run iOS simulator/device builds.

Unlike Android, iOS cannot guarantee custom full-length adhan playback while the app is terminated. Notification sounds are subject to Apple platform restrictions and user settings.

The canonical product name remains **Deen One**, with free access and no premium subscription.
