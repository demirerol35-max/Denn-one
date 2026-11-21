package com.deenone.prayers

import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/**
 * Validated batch of consecutive daily schedules. The native bridge can use
 * this when the web layer has obtained real API times for the next seven days.
 * Never extrapolate one day's prayer times to other dates.
 */
object PrayerWeekPayload {
    data class Week(val timezone: String, val days: List<PrayerSchedulePayload.Schedule>)

    fun matchesDay(week: Week?, day: PrayerSchedulePayload.Schedule): Boolean =
        week?.days?.firstOrNull { it.date == day.date }?.let {
            it.timezone == day.timezone && it.timings == day.timings
        } == true

    fun parse(json: String, requireToday: Boolean = true): Week? = runCatching {
        val root = JSONObject(json)
        val timezone = root.getString("timezone")
        ZoneId.of(timezone)
        val raw = root.getJSONArray("days")
        require(raw.length() in 1..7) { "Expected 1 to 7 days" }
        val days = (0 until raw.length()).map { index ->
            val item = raw.getJSONObject(index)
            require(item.getString("timezone") == timezone) { "Mixed timezones" }
            PrayerSchedulePayload.parse(item.toString())
                ?: error("Invalid day at index $index")
        }
        require(days.zipWithNext().all { (a, b) -> b.date == a.date.plusDays(1) }) {
            "Days must be consecutive"
        }
        val today = LocalDate.now(ZoneId.of(timezone))
        if (requireToday) require(days.first().date == today) { "Batch must start today" }
        else require(!days.last().date.isBefore(today)) { "Batch has expired" }
        Week(timezone, days)
    }.getOrNull()
}
