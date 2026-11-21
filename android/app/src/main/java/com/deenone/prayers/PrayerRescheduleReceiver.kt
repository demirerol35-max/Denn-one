package com.deenone.prayers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.app.AlarmManager

/**
 * Re-registers the last saved prayer alarms after a device reboot or
 * a clock/timezone change, app update, or exact-alarm permission grant.
 * Does not fetch a new day's prayer times.
 */
class PrayerRescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED ->
                PrayerScheduleCoordinator.restore(context)
        }
    }
}
