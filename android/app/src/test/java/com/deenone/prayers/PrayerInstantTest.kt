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

    @Test fun leapDayIsSupported() {
        val at = PrayerInstant.epochMillis(LocalDate.parse("2028-02-29"), "05:30", "Europe/Paris")
        assertEquals("2028-02-29T04:30:00Z", java.time.Instant.ofEpochMilli(at).toString())
    }
}
