package com.deenone.prayers

import org.junit.Assert.*
import org.junit.Test

class PrayerSchedulePayloadTest {
    private fun payload(date: String = "2026-11-21", zone: String = "Europe/Paris",
                        fajr: String = "06:12"): String = """
        {
          "date":"$date",
          "timezone":"$zone",
          "timings":{
            "Fajr":"$fajr",
            "Dhuhr":"12:24",
            "Asr":"14:43",
            "Maghrib":"16:58",
            "Isha":"18:32"
          }
        }
    """.trimIndent()

    @Test fun parsesValidPrayerTimes() {
        val parsed = PrayerSchedulePayload.parse(payload())
        assertNotNull(parsed)
        assertEquals("2026-11-21", parsed!!.date.toString())
        assertEquals("Europe/Paris", parsed.timezone)
        assertEquals("06:12", parsed.timings["Fajr"])
        assertEquals(5, parsed.timings.size)
    }

    @Test fun rejectsInvalidTimezone() {
        assertNull(PrayerSchedulePayload.parse(payload(zone = "Invalid/Zone")))
    }

    @Test fun rejectsImpossibleDate() {
        assertNull(PrayerSchedulePayload.parse(payload(date = "2026-02-30")))
    }

    @Test fun rejectsInvalidPrayerHour() {
        assertNull(PrayerSchedulePayload.parse(payload(fajr = "25:15")))
    }

    @Test fun rejectsMissingPrayer() {
        val withoutIsha = payload().replace("\"Isha\":\"18:32\"", "")
        assertNull(PrayerSchedulePayload.parse(withoutIsha))
    }

    @Test fun acceptsTimeWithApiTimezoneSuffix() {
        val parsed = PrayerSchedulePayload.parse(payload(fajr = "06:12 (CET)"))
        assertEquals("06:12", parsed?.timings?.get("Fajr"))
    }

    @Test fun rejectsMalformedJson() {
        assertNull(PrayerSchedulePayload.parse("{invalid"))
    }
}
