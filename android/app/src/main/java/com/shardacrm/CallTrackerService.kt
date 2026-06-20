package com.shardacrm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class CallTrackerService : Service() {
  companion object {
    const val CHANNEL_ID = "call_tracker_service_channel"
    const val NOTIFICATION_ID = 1001
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    startForeground(NOTIFICATION_ID, buildNotification())
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? {
    return null
  }

  override fun onDestroy() {
    stopForeground(true)
    super.onDestroy()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Call Tracker",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Keeps the call tracker service running"
      }
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Call recording active")
      .setContentText("Call tracker is running in the background")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }
}
