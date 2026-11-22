import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        DeenOneWebView()
            .ignoresSafeArea(edges: .bottom)
    }
}

struct DeenOneWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.load(URLRequest(url: URL(string: "https://demirerol35-max.github.io/Denn-one/vision.html")!))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == "https" && url.host == "demirerol35-max.github.io" &&
                (url.path == "/Denn-one" || url.path.hasPrefix("/Denn-one/")) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                if navigationAction.navigationType == .linkActivated &&
                    (url.scheme == "https" || url.scheme == "http") {
                    UIApplication.shared.open(url)
                }
            }
        }
    }
}
