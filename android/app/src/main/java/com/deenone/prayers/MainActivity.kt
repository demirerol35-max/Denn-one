package com.deenone.prayers

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Development WebView shell for the existing Deen One site.
 * No JavaScript interface is exposed: native prayer alarms are not yet connected.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var offlineNotice: View
    private var pendingLocation: Pair<String, GeolocationPermissions.Callback>? = null
    private val locationRequestCode = 1401

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String, callback: GeolocationPermissions.Callback
                ) {
                    val uri = runCatching { Uri.parse(origin) }.getOrNull()
                    if (uri?.scheme != "https" || uri.host != "demirerol35-max.github.io") {
                        callback.invoke(origin, false, false)
                        return
                    }
                    if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                        callback.invoke(origin, true, false)
                    } else {
                        pendingLocation?.let { (previousOrigin, previousCallback) ->
                            previousCallback.invoke(previousOrigin, false, false)
                        }
                        pendingLocation = origin to callback
                        requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), locationRequestCode)
                    }
                }
            }
            webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView, request: WebResourceRequest, error: WebResourceError
                ) {
                    if (request.isForMainFrame && ::offlineNotice.isInitialized) {
                        offlineNotice.visibility = View.VISIBLE
                    }
                }
                override fun onPageFinished(view: WebView, url: String) {
                    if (::offlineNotice.isInitialized &&
                        url.startsWith("https://demirerol35-max.github.io/Denn-one/") &&
                        view.title != "Web page not available") {
                        offlineNotice.visibility = View.GONE
                    }
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    val internal = uri.scheme == "https" &&
                        uri.host == "demirerol35-max.github.io" &&
                        (uri.path == "/Denn-one" || uri.path?.startsWith("/Denn-one/") == true)
                    if (internal) return false
                    if (request.isForMainFrame) {
                        // Only hand known safe web links to external apps.
                        if (uri.scheme == "https" || uri.scheme == "http") {
                            runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                        }
                    }
                    return true
                }
            }
        }
        val root = FrameLayout(this)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        offlineNotice = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(40, 40, 40, 40)
            setBackgroundColor(android.graphics.Color.WHITE)
            addView(TextView(this@MainActivity).apply {
                text = "Deen One ne peut pas charger la page. Vérifie ta connexion Internet."
                textSize = 18f
                gravity = Gravity.CENTER
            })
            addView(Button(this@MainActivity).apply {
                text = "Réessayer"
                setOnClickListener { webView.reload() }
            })
            visibility = View.GONE
        }
        root.addView(offlineNotice, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        if (savedInstanceState == null) {
            webView.loadUrl("https://demirerol35-max.github.io/Denn-one/vision.html")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != locationRequestCode) return
        pendingLocation?.let { (origin, callback) ->
            callback.invoke(origin, grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED, false)
        }
        pendingLocation = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Legacy Android back navigation")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        pendingLocation?.let { (origin, callback) -> callback.invoke(origin, false, false) }
        pendingLocation = null
        webView.destroy()
        super.onDestroy()
    }
}
