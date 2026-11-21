package com.deenone.prayers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-registers the last saved prayer alarms after a device reboot or
 * a clock/timezone change. Does not fetch a new day's prayer times.
 */
class PrayerRescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> PrayerScheduleCoordinator.restore(context)
        }
    }
}
