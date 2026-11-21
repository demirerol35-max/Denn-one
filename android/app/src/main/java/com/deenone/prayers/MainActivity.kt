package com.deenone.prayers

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Development WebView shell for the existing Deen One site.
 * No JavaScript interface is exposed: native prayer alarms are not yet connected.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
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
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    val internal = uri.scheme == "https" &&
                        uri.host == "demirerol35-max.github.io" &&
                        (uri.path == "/Denn-one" || uri.path?.startsWith("/Denn-one/") == true)
                    if (internal) return false
                    if (request.isForMainFrame) {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }
                    return true
                }
            }
        }
        setContentView(webView)
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
