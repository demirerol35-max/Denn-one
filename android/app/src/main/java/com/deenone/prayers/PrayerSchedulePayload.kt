package com.deenone.prayers

import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.LocalTime

/**
 * Validates the prayer schedule passed from the Deen One web layer.
 * This is a parser only: the Android WebView bridge is not connected yet.
 */
object PrayerSchedulePayload {
    data class Schedule(
        val date: LocalDate,
        val timezone: String,
        val timings: Map<String, String>
    )

    private val names = listOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
    // Accept plain HH:mm or an API timezone suffix, never arbitrary trailing text.
    private val clock = Regex("^(([01]\\d|2[0-3]):[0-5]\\d)(?: \\([^()\\s]+\\))?$")

    fun parse(json: String): Schedule? = runCatching {
        val data = JSONObject(json)
        val date = LocalDate.parse(data.getString("date"))
        val timezone = data.getString("timezone")
        ZoneId.of(timezone) // reject invalid timezone before scheduling
        val raw = data.getJSONObject("timings")
        val timings = names.associateWith { prayer ->
            val rawTime = raw.getString(prayer).trim()
            val value = clock.matchEntire(rawTime)?.groupValues?.get(1)
                ?: error("Invalid time for $prayer")
            LocalTime.parse(value)
            value
        }
        Schedule(date, timezone, timings)
    }.getOrNull()
}
