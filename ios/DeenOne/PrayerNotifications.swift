import Foundation
import UserNotifications

/// Native iOS prayer reminder scheduling foundation.
/// Only validated future Date values should be supplied by the trusted prayer timetable.
/// iOS limits pending local notifications, so refresh the next rolling window periodically.
enum PrayerNotifications {
    static let prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]

    static func requestAuthorization() async throws -> Bool {
        try await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge])
    }

    static func schedule(_ times: [(prayer: String, date: Date)]) async throws {
        let center = UNUserNotificationCenter.current()
        let valid = times.filter { prayers.contains($0.prayer) && $0.date > Date() }
            .sorted { $0.date < $1.date }
            .prefix(60)
        let old = await center.pendingNotificationRequests()
        center.removePendingNotificationRequests(withIdentifiers:
            old.filter { $0.identifier.hasPrefix("deen.prayer.") }.map(\.identifier))
        for item in valid {
            let content = UNMutableNotificationContent()
            content.title = "Deen One • " + item.prayer
            content.body = "C'est l'heure de la prière."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: max(1, item.date.timeIntervalSinceNow), repeats: false)
            let id = "deen.prayer.\(item.prayer).\(Int(item.date.timeIntervalSince1970))"
            try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
    }
}
