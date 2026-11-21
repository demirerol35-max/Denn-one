package com.deenone.prayers

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.time.LocalDate
import java.time.LocalTime

/**
 * Android-native prayer alarm foundation connected to the trusted WebView bridge.
 * Pass validated API prayer times and the API timezone; do not use device timezone.
 */
object PrayerAlarms {
    private const val CHANNEL = "deen_prayer_reminders"
    private val prayers = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")

    fun scheduleDay(
        context: Context,
        date: LocalDate,
        timezone: String,
        timings: Map<String, String>,
        notificationsEnabled: Boolean
    ) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        for ((index, prayer) in prayers.withIndex()) {
            val pending = pending(context, index, prayer)
            alarms.cancel(pending)
            if (!notificationsEnabled) continue
            val time = timings[prayer]?.trim()?.take(5) ?: continue
            val localTime = runCatching { LocalTime.parse(time) }.getOrNull() ?: continue
            val at = PrayerInstant.epochMillis(date, localTime.toString(), timezone)
            if (at <= System.currentTimeMillis()) continue
            // PendingIntent identity ignores extras. Update the stored expected
            // timestamp so a late broadcast from an older location is rejected.
            val scheduledPending = pending(context, index, prayer, at)
            // Exact-alarm permission can be revoked between the check and scheduling.
            // Fall back to an inexact alarm instead of crashing the application.
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
                    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, scheduledPending)
                } else {
                    alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, scheduledPending)
                }
            } catch (_: SecurityException) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, scheduledPending)
            }
        }
    }

    private fun pending(context: Context, index: Int, prayer: String, expectedAt: Long = 0L): PendingIntent =
        PendingIntent.getBroadcast(
            context, index,
            Intent(context, PrayerAlarmReceiver::class.java)
                .putExtra("prayer", prayer)
                .putExtra("expectedAt", expectedAt),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    fun cancelAll(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        prayers.forEachIndexed { index, prayer -> alarms.cancel(pending(context, index, prayer)) }
    }

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Rappels de prière", NotificationManager.IMPORTANCE_HIGH)
        )
    }

    fun exactAlarmsAllowed(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

    private fun weekRequestCode(date: LocalDate, index: Int): Int =
        Math.toIntExact(date.toEpochDay() * 10L + index + 100_000L)

    private fun weekPending(
        context: Context, date: LocalDate, index: Int, prayer: String, at: Long
    ): PendingIntent = PendingIntent.getBroadcast(
        context, weekRequestCode(date, index),
        Intent(context, PrayerAlarmReceiver::class.java)
            .putExtra("prayer", prayer)
            .putExtra("expectedAt", at)
            .putExtra("weekDate", date.toString()),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    fun cancelWeek(context: Context, days: List<LocalDate>) {
        val manager = context.getSystemService(AlarmManager::class.java)
        for (date in days) prayers.forEachIndexed { index, prayer ->
            manager.cancel(weekPending(context, date, index, prayer, 0L))
        }
    }

    fun scheduleWeek(context: Context, days: List<PrayerSchedulePayload.Schedule>, enabled: Boolean) {
        val manager = context.getSystemService(AlarmManager::class.java)
        for (day in days) {
            prayers.forEachIndexed { index, prayer ->
                val time = LocalTime.parse(day.timings.getValue(prayer))
                val at = PrayerInstant.epochMillis(day.date, time.toString(), day.timezone)
                val pending = weekPending(context, day.date, index, prayer, at)
                manager.cancel(pending)
                if (!enabled || at <= System.currentTimeMillis()) return@forEachIndexed
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
                        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
                    } else {
                        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
                    }
                } catch (_: SecurityException) {
                    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
                }
            }
        }
    }

    fun notificationsAllowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val manager = context.getSystemService(NotificationManager::class.java)
        if (!manager.areNotificationsEnabled()) return false
        val channel = manager.getNotificationChannel(CHANNEL)
        return channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE
    }

    internal fun notifyPrayer(context: Context, prayer: String) {
        if (!notificationsAllowed(context)) return
        ensureChannel(context)
        val openApp = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Heure de la prière : $prayer")
            .setContentText("C’est l’heure de $prayer")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java)
            .notify(prayer.hashCode(), notification)
    }
}

class PrayerAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val prayer = intent.getStringExtra("prayer") ?: return
        if (prayer !in listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")) return
        // A pending broadcast may arrive after reminders have been disabled or
        // after its stored schedule has expired. Never notify in those cases.
        if (!PrayerScheduleCoordinator.isEnabled(context) ||
            !PrayerScheduleCoordinator.hasSchedule(context)) return
        val expectedAt = intent.getLongExtra("expectedAt", 0L)
        if (expectedAt <= 0L) return
        val weekDate = intent.getStringExtra("weekDate")
        val currentExpectedAt = if (weekDate != null)
            PrayerScheduleCoordinator.expectedWeekAlarmTime(context, weekDate, prayer)
        else PrayerScheduleCoordinator.expectedAlarmTime(context, prayer)
        if (currentExpectedAt != expectedAt) return
        // A clock adjustment or an early delivery must never announce a prayer
        // before its scheduled instant. Allow a small clock precision margin.
        if (!PrayerAlarmTiming.isDue(expectedAt, System.currentTimeMillis())) return
        PrayerAlarms.notifyPrayer(context, prayer)
    }
}
