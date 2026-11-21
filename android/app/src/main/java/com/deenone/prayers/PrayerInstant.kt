package com.deenone.prayers

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/** Convert a prayer's local civil time using the prayer location's timezone. */
internal object PrayerInstant {
    fun epochMillis(date: LocalDate, time: String, timezone: String): Long =
        ZonedDateTime.of(date, LocalTime.parse(time), ZoneId.of(timezone))
            .toInstant().toEpochMilli()
}
