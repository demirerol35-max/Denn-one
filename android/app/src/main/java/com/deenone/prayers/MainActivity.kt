package com.deenone.prayers

import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.provider.Settings
import android.os.Build
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
import android.webkit.WebSettings
import android.webkit.CookieManager
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Development WebView shell for the existing Deen One site.
 * The origin-restricted WebView message bridge schedules native prayer alarms.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var offlineNotice: View
    private var mainPageFailed = false
    private var pendingLocation: Pair<String, GeolocationPermissions.Callback>? = null
    private val locationRequestCode = 1401
    private val notificationRequestCode = 1402
    private var notificationConsentPending = false
    private var reminderDialogOpen = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Create the notification channel before checking its permission state.
        // Users can then manage prayer reminders in Android system settings.
        PrayerAlarms.ensureChannel(this)
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportMultipleWindows(false)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String, callback: GeolocationPermissions.Callback
                ) {
                    val uri = runCatching { Uri.parse(origin) }.getOrNull()
                    if (uri?.scheme != "https" || uri.host != "demirerol35-max.github.io" ||
                        !isTrustedPrayerPage()) {
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
                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    mainPageFailed = false
                    // Revoke any outstanding geolocation prompt when navigation
                    // begins; its callback belongs to the previous document.
                    pendingLocation?.let { (origin, callback) ->
                        callback.invoke(origin, false, false)
                    }
                    pendingLocation = null
                }
                override fun onReceivedError(
                    view: WebView, request: WebResourceRequest, error: WebResourceError
                ) {
                    if (request.isForMainFrame && ::offlineNotice.isInitialized) {
                        mainPageFailed = true
                        offlineNotice.visibility = View.VISIBLE
                    }
                }
                override fun onPageFinished(view: WebView, url: String) {
                    if (::offlineNotice.isInitialized &&
                        url.startsWith("https://demirerol35-max.github.io/Denn-one/") &&
                        !mainPageFailed) {
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
                text = "Deen One ne peut pas charger la page. Vérifie ta connexion Internet. Les rappels de prière déjà programmés sur ce téléphone restent actifs si tu les as autorisés."
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
        // Only the trusted Deen One HTTPS origin can send native schedule messages.
        // This avoids exposing a broad JavascriptInterface to arbitrary pages.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView,
                "DeenOneAndroid",
                setOf("https://demirerol35-max.github.io")
            ) { _, message, sourceOrigin, isMainFrame, replyProxy ->
                if (!isMainFrame ||
                    sourceOrigin.scheme != "https" ||
                    sourceOrigin.host != "demirerol35-max.github.io" ||
                    sourceOrigin.port != -1
                ) return@addWebMessageListener
                // GitHub Pages shares an origin across repositories. Only the
                // Deen One repository path may control native prayer alarms.
                if (!isTrustedPrayerPage()) return@addWebMessageListener
                val request = runCatching { JSONObject(message.data ?: "") }.getOrNull()
                val type = request?.optString("type")
                val success = when (type) {
                    "schedule" -> {
                        val payload = request.optJSONObject("payload")?.toString()
                        payload != null && PrayerScheduleCoordinator.update(this, payload)
                    }
                    "scheduleWeek" -> {
                        val payload = request.optJSONObject("payload")?.toString()
                        payload != null && PrayerScheduleCoordinator.updateWeek(this, payload)
                    }
                    "enable" -> {
                        // Do not repeatedly request consent when reminders are already active.
                        if (PrayerScheduleCoordinator.isEnabled(this) &&
                            PrayerAlarms.notificationsAllowed(this)) {
                            refreshReminderStatusInWebView()
                        } else if (!reminderDialogOpen) {
                            reminderDialogOpen = true
                            AlertDialog.Builder(this)
                            .setTitle("Rappels des cinq prières")
                            .setMessage("Autoriser Deen One à programmer les rappels de prière sur ce téléphone ?")
                            .setNegativeButton("Non", null)
                            .setPositiveButton("Autoriser") { _, _ ->
                                if (Build.VERSION.SDK_INT >= 33 &&
                                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                                    notificationConsentPending = true
                                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), notificationRequestCode)
                                } else {
                                    if (PrayerAlarms.notificationsAllowed(this)) {
                                        PrayerScheduleCoordinator.setEnabled(this, true)
                                        offerExactAlarmPermission()
                                    } else {
                                        showNotificationSettingsDialog()
                                    }
                                    refreshReminderStatusInWebView()
                                }
                            }
                            .setOnDismissListener { reminderDialogOpen = false }
                            .show()
                        }
                        // Consent is asynchronous: this is an acknowledgement of the request,
                        // not confirmation that reminders are enabled.
                        true
                    }
                    "disable" -> {
                        PrayerScheduleCoordinator.setEnabled(this, false)
                        refreshReminderStatusInWebView()
                        true
                    }
                    "status" -> true
                    else -> false
                }
                replyProxy.postMessage(
                    JSONObject().put("type", type ?: "")
                        .put("ok", success)
                        .put("enabled", PrayerScheduleCoordinator.isEnabled(this))
                        .put("hasSchedule", PrayerScheduleCoordinator.hasSchedule(this))
                        .put("notificationPermissionGranted",
                            PrayerAlarms.notificationsAllowed(this))
                        .put("exactAlarmsAllowed", PrayerAlarms.exactAlarmsAllowed(this))
                        .toString()
                )
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl("https://demirerol35-max.github.io/Denn-one/vision.html")
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun isTrustedPrayerPage(): Boolean {
        val page = runCatching { Uri.parse(webView.url ?: "") }.getOrNull()
        return page?.scheme == "https" &&
            page.host == "demirerol35-max.github.io" &&
            page.path == "/Denn-one/vision.html" &&
            page.port == -1 &&
            page.userInfo == null
    }

    private fun showNotificationSettingsDialog() {
        AlertDialog.Builder(this)
            .setTitle("Notifications désactivées")
            .setMessage("Les notifications de Deen One sont bloquées. Autorise-les dans les paramètres Android pour recevoir les rappels de prière.")
            .setNegativeButton("Plus tard", null)
            .setPositiveButton("Ouvrir les paramètres") { _, _ ->
                runCatching {
                    startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                    )
                }.onFailure {
                    runCatching {
                        startActivity(
                            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                                .setData(Uri.parse("package:$packageName"))
                        )
                    }.onFailure {
                        AlertDialog.Builder(this)
                            .setMessage("Ouvre les paramètres Android, puis Applications, Deen One et Notifications.")
                            .setPositiveButton("OK", null)
                            .show()
                    }
                }
            }
            .show()
    }

    private fun offerExactAlarmPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            PrayerAlarms.exactAlarmsAllowed(this)) return
        AlertDialog.Builder(this)
            .setTitle("Rappels de prière à l'heure")
            .setMessage("Android limite actuellement les alarmes exactes. Les rappels peuvent arriver en retard. Tu peux autoriser les alarmes et rappels dans les paramètres pour améliorer leur ponctualité.")
            .setNegativeButton("Plus tard", null)
            .setPositiveButton("Ouvrir les paramètres") { _, _ ->
                runCatching {
                    startActivity(
                        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                            .setData(Uri.parse("package:$packageName"))
                    )
                }.onFailure {
                    AlertDialog.Builder(this)
                        .setMessage("Ouvre les paramètres Android, puis autorise les alarmes et rappels pour Deen One.")
                        .setPositiveButton("OK", null)
                        .show()
                }
            }
            .show()
    }

    private fun refreshReminderStatusInWebView() {
        // The web layer listens for focus and asks the native bridge for status.
        // Never claim reminders are active before Android has handled consent.
        webView.evaluateJavascript("window.dispatchEvent(new Event('focus'))", null)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == notificationRequestCode) {
            if (notificationConsentPending) {
                if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED &&
                    PrayerAlarms.notificationsAllowed(this)) {
                    PrayerScheduleCoordinator.setEnabled(this, true)
                    offerExactAlarmPermission()
                } else {
                    AlertDialog.Builder(this)
                        .setTitle("Notifications non autorisées")
                        .setMessage("Les rappels de prière restent désactivés. Tu pourras autoriser les notifications de Deen One dans les paramètres Android.")
                        .setPositiveButton("Compris", null)
                        .show()
                }
            }
            refreshReminderStatusInWebView()
            notificationConsentPending = false
            return
        }
        if (requestCode != locationRequestCode) return
        pendingLocation?.let { (origin, callback) ->
            // The user may have navigated away while Android displayed the
            // permission prompt. Never grant location to a different page.
            callback.invoke(
                origin,
                grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED &&
                    isTrustedPrayerPage(),
                false
            )
        }
        pendingLocation = null
    }

    override fun onResume() {
        super.onResume()
        // Re-evaluate the stored local date and restore today's alarms after
        // returning from Android settings or a period in the background.
        PrayerScheduleCoordinator.restore(this)
        if (::webView.isInitialized) refreshReminderStatusInWebView()
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
