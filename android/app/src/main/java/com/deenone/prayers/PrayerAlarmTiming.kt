package com.deenone.prayers

/** Pure timing guard for a delivered Android alarm. */
internal object PrayerAlarmTiming {
    fun isDue(expectedAt: Long, now: Long): Boolean =
        expectedAt > 0L && now >= expectedAt
}
