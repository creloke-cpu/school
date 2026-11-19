import SwiftUI

@main
struct FirstGearApp: App {
    @State private var signInLink: URL?

    var body: some Scene {
        WindowGroup {
            ContentView(signInLink: signInLink)
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    guard let url = activity.webpageURL,
                          url.scheme == "https",
                          url.host == "first-gear.store",
                          url.path == "/api/auth/verify" else { return }
                    signInLink = url
                }
        }
    }
}
