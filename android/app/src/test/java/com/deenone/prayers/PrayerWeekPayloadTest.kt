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

    @Test fun restoresUnexpiredBatchAfterMidnight() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val payload = batch(day(today.minusDays(1)), day(today))
        assertNull(PrayerWeekPayload.parse(payload))
        val restored = PrayerWeekPayload.parse(payload, requireToday = false)
        assertNotNull(restored)
        assertEquals(2, restored!!.days.size)
    }

    @Test fun rejectsFullyExpiredStoredBatch() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val payload = batch(day(today.minusDays(2)), day(today.minusDays(1)))
        assertNull(PrayerWeekPayload.parse(payload, requireToday = false))
    }

    @Test fun permitsExpiredBatchOnlyForAlarmCleanup() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val expired = batch(day(today.minusDays(3)), day(today.minusDays(2)))
        assertNull(PrayerWeekPayload.parse(expired, requireToday = false))
        val cleanup = PrayerWeekPayload.parse(
            expired, requireToday = false, allowExpired = true
        )
        assertNotNull(cleanup)
        assertEquals(2, cleanup!!.days.size)
    }

    @Test fun matchesSecondDayWithoutDiscardingFutureAlarms() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val week = PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1))))
        val second = PrayerSchedulePayload.parse(day(today.plusDays(1)))!!
        assertTrue(PrayerWeekPayload.matchesDay(week, second))
    }

    @Test fun doesNotMatchDayOutsideStoredWeek() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val week = PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1))))
        val outside = PrayerSchedulePayload.parse(day(today.plusDays(2)))!!
        assertFalse(PrayerWeekPayload.matchesDay(week, outside))
    }

    @Test fun doesNotMatchSameDateInAnotherTimezone() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val week = PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1))))
        val changedZone = PrayerSchedulePayload.parse(day(today.plusDays(1), "Asia/Istanbul"))!!
        assertFalse(PrayerWeekPayload.matchesDay(week, changedZone))
    }

    @Test fun rejectsChangedPrayerTimesForSameDay() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val week = PrayerWeekPayload.parse(batch(day(today), day(today.plusDays(1))))
        val changed = PrayerSchedulePayload.parse(day(today.plusDays(1)).replace("05:30", "05:31"))!!
        assertFalse(PrayerWeekPayload.matchesDay(week, changed))
    }

    @Test fun rejectsNonConsecutiveDatesAcrossMonthBoundary() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val endOfMonth = today.withDayOfMonth(today.lengthOfMonth())
        // A stored batch can be inspected independently of the current date.
        val invalid = batch(day(endOfMonth), day(endOfMonth.plusDays(2)))
        assertNull(PrayerWeekPayload.parse(
            invalid, requireToday = false, allowExpired = true
        ))
    }

    @Test fun acceptsConsecutiveDatesAcrossMonthBoundary() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        val endOfMonth = today.withDayOfMonth(today.lengthOfMonth())
        val valid = batch(day(endOfMonth), day(endOfMonth.plusDays(1)))
        assertNotNull(PrayerWeekPayload.parse(
            valid, requireToday = false, allowExpired = true
        ))
    }

    @Test fun rejectsMalformedPrayerTimes() {
        val today = LocalDate.now(java.time.ZoneId.of(zone))
        assertNull(PrayerWeekPayload.parse(batch(day(today).replace("05:30", "25:30"))))
    }
}
