import SwiftUI
import UIKit
import WebKit

private let firstGearURL = URL(string: "https://first-gear.store/")!

final class WebState: ObservableObject {
    @Published var isLoading = true
    @Published var errorMessage: String?
    weak var webView: WKWebView?
    var lastSignInLink: URL?

    func retry() {
        errorMessage = nil
        isLoading = true
        webView?.load(URLRequest(url: firstGearURL))
    }
}

struct ContentView: View {
    let signInLink: URL?
    @StateObject private var webState = WebState()
    @State private var offlineSection = "Home"

    var body: some View {
        ZStack {
            FirstGearWebView(state: webState, signInLink: signInLink)
                .opacity(webState.errorMessage == nil ? 1 : 0)
                .accessibilityHidden(webState.errorMessage != nil)

            if let message = webState.errorMessage {
                offlineView(message: message)
            } else if webState.isLoading {
                ProgressView("Loading FirstGear...")
                    .padding()
                    .background(.regularMaterial)
                    .cornerRadius(12)
            }
        }
    }

    private func offlineView(message: String) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("FIRSTGEAR")
                .font(.title2.bold())
                .foregroundColor(.red)
            Text("FirstGear is unavailable")
                .font(.title2.bold())
            Text(message)
                .foregroundColor(.secondary)
            Button("Try again") { webState.retry() }
                .buttonStyle(.borderedProminent)
                .tint(.red)
            HStack {
                ForEach(["Home", "Lessons", "Progress", "Account"], id: \.self) { section in
                    Button(section) { offlineSection = section }
                        .font(.caption.bold())
                        .foregroundColor(offlineSection == section ? .red : .secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical)
            Text(offlineSection)
                .font(.headline)
            Text("Connect to the internet to load your account information.")
                .foregroundColor(.secondary)
            ForEach(0..<3) { _ in
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.15))
                    .frame(height: 65)
            }
            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(.systemBackground))
    }
}

struct FirstGearWebView: UIViewRepresentable {
    @ObservedObject var state: WebState
    let signInLink: URL?

    func makeCoordinator() -> Coordinator {
        Coordinator(state: state)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.limitsNavigationsToAppBoundDomains = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        state.webView = webView
        webView.load(URLRequest(url: firstGearURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let url = signInLink, url != state.lastSignInLink else { return }
        state.lastSignInLink = url
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let state: WebState

        init(state: WebState) {
            self.state = state
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.isLoading = true
            state.errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showFailure(error)
        }

        private func showFailure(_ error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { return }
            state.isLoading = false
            state.errorMessage = "Check your internet connection and try again. \(error.localizedDescription)"
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == "https" && url.host == "first-gear.store" {
                if navigationAction.targetFrame == nil {
                    webView.load(navigationAction.request)
                    decisionHandler(.cancel)
                } else {
                    decisionHandler(.allow)
                }
                return
            }
            decisionHandler(.cancel)
            guard ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") else {
                state.errorMessage = "This link cannot be opened."
                return
            }
            UIApplication.shared.open(url) { success in
                if !success {
                    self.state.errorMessage = "This link could not be opened."
                }
            }
        }
    }
}
