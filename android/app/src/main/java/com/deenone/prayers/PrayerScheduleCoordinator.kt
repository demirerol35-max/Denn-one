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
    private const val WEEK = "week"

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
        val previousWeek = storedWeek(context)
        val matchesWeek = previousWeek?.days?.firstOrNull { day ->
            day.date == parsed.date
        }?.let { day ->
            day.timezone == parsed.timezone && day.timings == parsed.timings
        } == true
        // A normal refresh of today's unchanged API times must not erase the
        // future alarms already saved for the coming days.
        if (matchesWeek) return true
        if (!preferences.edit().putString(SCHEDULE, payload).remove(WEEK).commit()) return false
        previousWeek?.let { PrayerAlarms.cancelWeek(context, it.days.map { day -> day.date }) }
        PrayerAlarms.scheduleDay(
            context, parsed.date, parsed.timezone, parsed.timings, enabled
        )
        return true
    }

    private fun storedWeek(context: Context): PrayerWeekPayload.Week? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(WEEK, null)?.let { PrayerWeekPayload.parse(it, requireToday = false) }

    fun updateWeek(context: Context, payload: String): Boolean {
        val week = PrayerWeekPayload.parse(payload) ?: return false
        val old = storedWeek(context)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.edit().putString(WEEK, payload).commit()) return false
        old?.let { PrayerAlarms.cancelWeek(context, it.days.map { day -> day.date }) }
        PrayerAlarms.cancelAll(context)
        PrayerAlarms.scheduleWeek(context, week.days, isEnabled(context))
        return true
    }

    fun isEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ENABLED, false)

    fun hasSchedule(context: Context): Boolean =
        storedWeek(context)?.days?.any { day ->
            !day.date.isBefore(java.time.LocalDate.now(java.time.ZoneId.of(day.timezone)))
        } == true ||
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

    fun expectedWeekAlarmTime(context: Context, date: String, prayer: String): Long? {
        val day = storedWeek(context)?.days?.firstOrNull { it.date.toString() == date } ?: return null
        if (day.date.isBefore(java.time.LocalDate.now(java.time.ZoneId.of(day.timezone)))) return null
        val time = day.timings[prayer]?.let(java.time.LocalTime::parse) ?: return null
        return java.time.ZonedDateTime.of(day.date, time, java.time.ZoneId.of(day.timezone))
            .toInstant().toEpochMilli()
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!preferences.edit().putBoolean(ENABLED, enabled).commit()) return
        if (!enabled) {
            PrayerAlarms.cancelAll(context)
            storedWeek(context)?.let { PrayerAlarms.cancelWeek(context, it.days.map { day -> day.date }) }
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
            storedWeek(context)?.let { week ->
                PrayerAlarms.cancelWeek(context, week.days.map { it.date })
            }
            return false
        }
        val week = storedWeek(context)
        if (week != null && week.days.any { day ->
                !day.date.isBefore(java.time.LocalDate.now(java.time.ZoneId.of(day.timezone)))
            }) {
            PrayerAlarms.cancelAll(context)
            PrayerAlarms.scheduleWeek(context, week.days, true)
            return true
        }
        // An expired weekly batch must not leave alarms pending from earlier
        // dates, even if the device clock or timezone was changed.
        week?.let { PrayerAlarms.cancelWeek(context, it.days.map { day -> day.date }) }
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
        storedWeek(context)?.let { PrayerAlarms.cancelWeek(context, it.days.map { day -> day.date }) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(SCHEDULE).remove(WEEK).apply()
    }
}
