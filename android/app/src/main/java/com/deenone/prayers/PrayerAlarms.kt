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
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Android-native prayer alarm foundation. Not wired into the web app yet.
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
        val zone = ZoneId.of(timezone)
        for ((index, prayer) in prayers.withIndex()) {
            val pending = pending(context, index, prayer)
            alarms.cancel(pending)
            if (!notificationsEnabled) continue
            val time = timings[prayer]?.trim()?.take(5) ?: continue
            val localTime = runCatching { LocalTime.parse(time) }.getOrNull() ?: continue
            val at = ZonedDateTime.of(date, localTime, zone).toInstant().toEpochMilli()
            if (at <= System.currentTimeMillis()) continue
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            } else {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
            }
        }
    }

    private fun pending(context: Context, index: Int, prayer: String): PendingIntent =
        PendingIntent.getBroadcast(
            context, index,
            Intent(context, PrayerAlarmReceiver::class.java).putExtra("prayer", prayer),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    fun cancelAll(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        prayers.forEachIndexed { index, prayer -> alarms.cancel(pending(context, index, prayer)) }
    }

    fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, "Prayer reminders", NotificationManager.IMPORTANCE_HIGH)
        )
    }

    internal fun notifyPrayer(context: Context, prayer: String) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Prayer time: $prayer")
            .setContentText("It is time for $prayer")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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
        PrayerAlarms.notifyPrayer(context, prayer)
    }
}
