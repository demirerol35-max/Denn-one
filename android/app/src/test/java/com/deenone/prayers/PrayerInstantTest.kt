package com.deenone.prayers

import org.junit.Assert.*
import org.junit.Test
import java.time.LocalDate

class PrayerInstantTest {
    @Test fun parisWinterAndSummerUseDifferentUtcOffsets() {
        val winter = PrayerInstant.epochMillis(LocalDate.parse("2027-01-15"), "12:00", "Europe/Paris")
        val summer = PrayerInstant.epochMillis(LocalDate.parse("2027-07-15"), "12:00", "Europe/Paris")
        assertEquals("2027-01-15T11:00:00Z", java.time.Instant.ofEpochMilli(winter).toString())
        assertEquals("2027-07-15T10:00:00Z", java.time.Instant.ofEpochMilli(summer).toString())
    }

    @Test fun istanbulUsesItsOwnTimezoneNotDeviceTimezone() {
        val at = PrayerInstant.epochMillis(LocalDate.parse("2027-01-15"), "12:00", "Europe/Istanbul")
        assertEquals("2027-01-15T09:00:00Z", java.time.Instant.ofEpochMilli(at).toString())
    }

    @Test fun sameLocalTimeInDifferentCitiesProducesDifferentInstants() {
        val date = LocalDate.parse("2027-01-15")
        val paris = PrayerInstant.epochMillis(date, "06:30", "Europe/Paris")
        val istanbul = PrayerInstant.epochMillis(date, "06:30", "Europe/Istanbul")
        assertEquals(2L * 60L * 60L * 1000L, paris - istanbul)
    }

    @Test fun midnightUsesPrayerLocationDate() {
        val at = PrayerInstant.epochMillis(LocalDate.parse("2027-01-15"), "00:00", "Europe/Istanbul")
        assertEquals("2027-01-14T21:00:00Z", java.time.Instant.ofEpochMilli(at).toString())
    }

    @Test fun leapDayIsSupported() {
        val at = PrayerInstant.epochMillis(LocalDate.parse("2028-02-29"), "05:30", "Europe/Paris")
        assertEquals("2028-02-29T04:30:00Z", java.time.Instant.ofEpochMilli(at).toString())
    }
    @Test fun parisSpringClockChangeUsesSummerOffsetAfterTransition() {
        val before = PrayerInstant.epochMillis(LocalDate.parse("2027-03-28"), "01:30", "Europe/Paris")
        val after = PrayerInstant.epochMillis(LocalDate.parse("2027-03-28"), "03:30", "Europe/Paris")
        assertEquals("2027-03-28T00:30:00Z", java.time.Instant.ofEpochMilli(before).toString())
        assertEquals("2027-03-28T01:30:00Z", java.time.Instant.ofEpochMilli(after).toString())
    }

    @Test fun parisAutumnClockChangeUsesWinterOffsetAfterTransition() {
        val before = PrayerInstant.epochMillis(LocalDate.parse("2027-10-31"), "01:30", "Europe/Paris")
        val after = PrayerInstant.epochMillis(LocalDate.parse("2027-10-31"), "03:30", "Europe/Paris")
        assertEquals("2027-10-30T23:30:00Z", java.time.Instant.ofEpochMilli(before).toString())
        assertEquals("2027-10-31T02:30:00Z", java.time.Instant.ofEpochMilli(after).toString())
    }
}
