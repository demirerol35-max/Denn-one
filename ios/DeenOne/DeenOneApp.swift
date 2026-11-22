import SwiftUI

@main
struct DeenOneApp: App {
    @UIApplicationDelegateAdaptor(DeenOneAppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
