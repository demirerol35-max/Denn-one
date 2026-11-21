package com.deenone.prayers

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/**
 * Temporary launcher for verifying the native Android project builds.
 * The production Deen One UI and secure web/native bridge are not connected yet.
 */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "Deen One — Android development build"
            textSize = 20f
            setPadding(32, 64, 32, 32)
        })
    }
}
