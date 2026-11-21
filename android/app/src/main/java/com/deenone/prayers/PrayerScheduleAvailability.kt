package com.deenone.prayers

/** Determine whether a validated schedule still contains a future prayer. */
internal object PrayerScheduleAvailability {
    fun hasFuturePrayer(day: PrayerSchedulePayload.Schedule, nowMillis: Long): Boolean =
        day.timings.values.any { time ->
            PrayerInstant.epochMillis(day.date, time, day.timezone) > nowMillis
        }
}
