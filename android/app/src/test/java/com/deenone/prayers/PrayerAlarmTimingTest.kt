package com.deenone.prayers

import org.junit.Assert.*
import org.junit.Test

class PrayerAlarmTimingTest {
    private val scheduled = 1_800_000_000_000L

    @Test fun rejectsMissingExpectedTimestamp() {
        assertFalse(PrayerAlarmTiming.isDue(0L, scheduled))
        assertFalse(PrayerAlarmTiming.isDue(-1L, scheduled))
    }

    @Test fun rejectsAnyEarlyAlarm() {
        assertFalse(PrayerAlarmTiming.isDue(scheduled, scheduled - 60_001L))
        assertFalse(PrayerAlarmTiming.isDue(scheduled, scheduled - 1L))
    }

    @Test fun acceptsAlarmAtExactTime() {
        assertTrue(PrayerAlarmTiming.isDue(scheduled, scheduled))
    }

    @Test fun acceptsDelayedAlarm() {
        assertTrue(PrayerAlarmTiming.isDue(scheduled, scheduled + 300_000L))
    }
}
