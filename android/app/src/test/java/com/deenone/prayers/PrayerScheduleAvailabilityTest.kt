package com.deenone.prayers

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class PrayerScheduleAvailabilityTest {
    private val day = PrayerSchedulePayload.Schedule(
        LocalDate.parse("2027-01-15"),
        "Europe/Paris",
        mapOf(
            "Fajr" to "06:30", "Dhuhr" to "12:30", "Asr" to "15:30",
            "Maghrib" to "17:30", "Isha" to "19:00"
        )
    )

    @Test fun futurePrayerRemainsBeforeFirstPrayer() {
        val now = PrayerInstant.epochMillis(day.date, "06:29", day.timezone)
        assertTrue(PrayerScheduleAvailability.hasFuturePrayer(day, now))
    }

    @Test fun futurePrayerRemainsBetweenPrayers() {
        val now = PrayerInstant.epochMillis(day.date, "17:45", day.timezone)
        assertTrue(PrayerScheduleAvailability.hasFuturePrayer(day, now))
    }

    @Test fun scheduleExpiresAtLastPrayer() {
        val now = PrayerInstant.epochMillis(day.date, "19:00", day.timezone)
        assertFalse(PrayerScheduleAvailability.hasFuturePrayer(day, now))
    }

    @Test fun finalPrayerIsDueEvenWhenNoFuturePrayerRemains() {
        val isha = PrayerInstant.epochMillis(day.date, "19:00", day.timezone)
        assertFalse(PrayerScheduleAvailability.hasFuturePrayer(day, isha))
        assertTrue(PrayerAlarmTiming.isDue(isha, isha))
    }

    @Test fun yesterdayScheduleHasNoFuturePrayer() {
        val now = PrayerInstant.epochMillis(day.date.plusDays(1), "00:00", day.timezone)
        assertFalse(PrayerScheduleAvailability.hasFuturePrayer(day, now))
    }
}
