package com.deenone.prayers

import android.content.Context

/**
 * Native schedule coordinator. Call only from a trusted app-owned WebView
 * integration after checking the message origin.
 *
 * The WebView bridge requests explicit user consent before enabling reminders.
 */
object PrayerScheduleCoordinator {
    private const val PREFS = "deen_native_prayers"
    private const val SCHEDULE = "schedule"
    private const val ENABLED = "enabled"

    /**
     * Accepts a validated daily schedule and replaces the previous day's alarms.
     * Returns false for malformed payloads; never stores invalid data.
     */
    fun update(context: Context, payload: String): Boolean {
        val parsed = PrayerSchedulePayload.parse(payload) ?: return false
        // Never replace a valid future schedule with an expired one.
        val todayAtPrayerLocation = java.time.LocalDate.now(java.time.ZoneId.of(parsed.timezone))
        if (parsed.date != todayAtPrayerLocation) return false
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val enabled = preferences.getBoolean(ENABLED, false)
        // Only today's schedule is supported until multi-day alarms are implemented.
        // Save before scheduling so a later boot receiver can restore the schedule.
        if (!preferences.edit().putString(SCHEDULE, payload).commit()) return false
        PrayerAlarms.scheduleDay(
            context, parsed.date, parsed.timezone, parsed.timings, enabled
        )
        return true
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

    fun hasSchedule(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SCHEDULE, null)?.let { stored ->
                PrayerSchedulePayload.parse(stored)?.let { parsed ->
                    parsed.date == java.time.LocalDate.now(java.time.ZoneId.of(parsed.timezone))
                }
            } == true

    fun expectedAlarmTime(context: Context, prayer: String): Long? {
        if (prayer !in setOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")) return null
        val stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SCHEDULE, null) ?: return null
        val schedule = PrayerSchedulePayload.parse(stored) ?: return null
        val zone = java.time.ZoneId.of(schedule.timezone)
        if (schedule.date != java.time.LocalDate.now(zone)) return null
        val time = schedule.timings[prayer]?.let(java.time.LocalTime::parse) ?: return null
        return java.time.ZonedDateTime.of(schedule.date, time, zone)
            .toInstant().toEpochMilli()
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!preferences.edit().putBoolean(ENABLED, enabled).commit()) return
        if (!enabled) {
            PrayerAlarms.cancelAll(context)
            return
        }
        restore(context)
    }

    /**
     * Restores only the stored date. Future dates still require fresh prayer data;
     * never reuse expired times after reboot.
     */
    fun restore(context: Context): Boolean {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!preferences.getBoolean(ENABLED, false)) {
            PrayerAlarms.cancelAll(context)
            return false
        }
        val payload = preferences.getString(SCHEDULE, null) ?: return false
        val parsed = PrayerSchedulePayload.parse(payload) ?: return false
        val today = java.time.LocalDate.now(java.time.ZoneId.of(parsed.timezone))
        if (parsed.date != today) {
            PrayerAlarms.cancelAll(context)
            return false
        }
        PrayerAlarms.scheduleDay(
            context, parsed.date, parsed.timezone, parsed.timings, true
        )
        return true
    }

    fun clear(context: Context) {
        PrayerAlarms.cancelAll(context)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(SCHEDULE).apply()
    }
}
