package com.deenone.prayers

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class PrayerWeekPayloadTest {
    private val zone = "Europe/Paris"
    private fun day(date: LocalDate, timezone: String = zone): String =
        """{"date":"$date","timezone":"$timezone","timings":{"Fajr":"05:30","Dhuhr":"12:30","Asr":"15:30","Maghrib":"18:30","Isha":"20:00"}}"""
    private fun batch(vararg days: String, timezone: String = zone): String =
        """{"timezone":"$timezone","days":[${days.joinToString(",")}]}"""

    @Test fun acceptsConsecutiveDaysStartingToday() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val parsed = PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1))))
        assertNotNull(parsed)
        assertEquals(2, parsed!!.days.size)
    }

    @Test fun rejectsGaps() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(2)))))
    }

    @Test fun rejectsMixedTimezones() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1), "Asia/Istanbul"))))
    }

    @Test fun rejectsStaleBatch() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(day(today.minusDays(1)))))
    }

    @Test fun rejectsMoreThanSevenDays() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(*(0L..7L).map { day(today.plusDays(it)) }.toTypedArray())))
    }

    @Test fun rejectsMalformedPrayerTimes() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(day(today).replace("05:30", "25:30"))))
    }
}
