package com.shardacrm

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.media.MediaRecorder
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.IOException
import java.util.UUID

class CallTrackerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var recorder: MediaRecorder? = null
  private var isRecording = false
  private var outputFilePath: String? = null
  private var phoneStateListener: PhoneStateListener? = null
  private var telephonyManager: TelephonyManager? = null
  private var currentPhoneNumber: String? = null
  private var currentCallType: String? = null
  private var currentDeviceCallId: String? = null
  private var callStartTimestamp: Long = 0L
  private var lastCallState = TelephonyManager.CALL_STATE_IDLE
  private var currentAudioSource: Int = MediaRecorder.AudioSource.MIC

  override fun getName(): String = "CallTrackerModule"

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap?) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  @ReactMethod
  fun initCallTracker(promise: Promise) {
    try {
      val context = reactContext.applicationContext
      telephonyManager =
        context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

      phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
          when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK -> {
              if (!isRecording) {
                // NOTE: `phoneNumber` is null on Android 10+ for privacy reasons.
                // We capture the real number from CallLog on IDLE (see below).
                val callType = when (lastCallState) {
                  TelephonyManager.CALL_STATE_RINGING -> "Incoming"
                  else -> "Outgoing"
                }
                currentPhoneNumber = null // will be filled from CallLog
                currentCallType = callType
                currentDeviceCallId = UUID.randomUUID().toString()
                callStartTimestamp = System.currentTimeMillis()
                startRecordingInternal()
              }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
              if (isRecording) {
                stopRecordingInternal()
              }
            }
          }
          lastCallState = state
        }
      }

      telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
      promise.resolve(true)
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "initCallTracker error", error)
      promise.reject("INIT_FAILED", error)
    }
  }

  @ReactMethod
  fun startCallTracker(promise: Promise) {
    try {
      if (phoneStateListener == null || telephonyManager == null) {
        initCallTracker(promise)
        return
      }
      telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
      startForegroundService(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "startCallTracker error", error)
      promise.reject("START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopCallTracker(promise: Promise) {
    try {
      telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
      stopRecordingInternal()
      stopForegroundService(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "stopCallTracker error", error)
      promise.reject("STOP_FAILED", error)
    }
  }

  /**
   * Recording: try VOICE_COMMUNICATION first, fall back to MIC.
   * REALITY (Approach 1): on Android 10+, VOICE_CALL throws SecurityException for
   * non-system apps, so we don't even try it. MIC always works but captures the
   * near-end (executive) only; the far-end (customer) is captured only if the
   * executive uses speakerphone. That's the inherent Salesmax-style limitation.
   */
  private fun startRecordingInternal() {
    try {
      val outputDir = reactContext.cacheDir
      // FIX #2: .m4a (MPEG4 + AAC) — backend multer accepts it; .mp4 is rejected.
      val outputFile = File(outputDir, "call_recording_${System.currentTimeMillis()}.m4a")
      outputFilePath = outputFile.absolutePath

      val audioSourcesToTry = listOf(
        MediaRecorder.AudioSource.VOICE_COMMUNICATION,
        MediaRecorder.AudioSource.MIC,
      )

      var started = false
      for (source in audioSourcesToTry) {
        try {
          val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(reactContext)
          } else {
            @Suppress("DEPRECATION") MediaRecorder()
          }
          rec.apply {
            setAudioSource(source)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(64000)
            setAudioSamplingRate(16000)
            setOutputFile(outputFilePath)
            prepare()
            start()
          }
          recorder = rec
          currentAudioSource = source
          isRecording = true
          started = true
          Log.i("CallTrackerModule", "Recording started with source $source")
          break
        } catch (error: Exception) {
          Log.w("CallTrackerModule", "Recording failed with source $source", error)
          try { recorder?.release() } catch (_: Exception) {}
          recorder = null
          isRecording = false
        }
      }

      if (!started) {
        Log.w("CallTrackerModule", "Unable to start recording with any audio source")
        outputFilePath = null
      }
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "startRecordingInternal error", error)
      isRecording = false
      try { recorder?.release() } catch (_: Exception) {}
      recorder = null
    }
  }

  private fun stopRecordingInternal() {
    var recordingPath: String? = null
    try {
      recorder?.apply {
        stop()
        release()
      }
      recordingPath = outputFilePath
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "stopRecordingInternal recorder error", error)
    } finally {
      recorder = null
      isRecording = false
      outputFilePath = null
    }

    // FIX #3: the phone number is not delivered by PhoneStateListener on modern
    // Android. Wait for the system to write the CallLog entry, then read the
    // REAL number, type, duration, and timestamp from it.
    val capturedFilePath = recordingPath
    val capturedDeviceCallId = currentDeviceCallId
    val capturedStartTs = callStartTimestamp
    val provisionalCallType = currentCallType ?: "Outgoing"

    // reset device-side state
    currentPhoneNumber = null
    currentCallType = null
    currentDeviceCallId = null
    callStartTimestamp = 0L

    if (capturedFilePath.isNullOrBlank()) return

    Handler(Looper.getMainLooper()).postDelayed({
      enrichAndEmitFromCallLog(
        filePath = capturedFilePath,
        deviceCallId = capturedDeviceCallId,
        provisionalCallType = provisionalCallType,
        fallbackTimestamp = capturedStartTs,
      )
    }, CALLLOG_QUERY_DELAY_MS)
  }

  /**
   * Reads the most recent CallLog row to get the accurate number / type /
   * duration. Falls back to whatever we captured during the call if the row
   * isn't available yet.
   */
  private fun enrichAndEmitFromCallLog(
    filePath: String,
    deviceCallId: String?,
    provisionalCallType: String,
    fallbackTimestamp: Long,
  ) {
    var number: String? = null
    var callType = provisionalCallType
    var durationSeconds = 0
    var callTimestamp = fallbackTimestamp

    try {
      val cursor = reactContext.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        arrayOf(
          CallLog.Calls.NUMBER,
          CallLog.Calls.TYPE,
          CallLog.Calls.DURATION,
          CallLog.Calls.DATE,
        ),
        null,
        null,
        "${CallLog.Calls.DATE} DESC",
      )
      cursor?.use {
        if (it.moveToFirst()) {
          number = it.getString(0)
          durationSeconds = it.getInt(2)
          val date = it.getLong(3)
          if (date > 0) callTimestamp = date
          callType = when (it.getInt(1)) {
            CallLog.Calls.INCOMING_TYPE -> "Incoming"
            CallLog.Calls.OUTGOING_TYPE -> "Outgoing"
            CallLog.Calls.MISSED_TYPE -> "Missed"
            CallLog.Calls.REJECTED_TYPE -> "Rejected"
            else -> provisionalCallType
          }
        }
      }
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "CallLog query failed", error)
    }

    val payload = Arguments.createMap().apply {
      putString("recordingFilePath", filePath)
      putString("phoneNumber", number ?: "")
      putString("callType", callType)
      putInt("duration", durationSeconds)
      putDouble("callTimestamp", callTimestamp.toDouble())
      putString("deviceCallId", deviceCallId)
      putInt("audioSource", currentAudioSource)
    }
    sendEvent("CallRecordingCompleted", payload)
  }

  private fun startForegroundService(context: Context) {
    try {
      val serviceIntent = Intent(context, CallTrackerService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
      } else {
        context.startService(serviceIntent)
      }
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "startForegroundService error", error)
    }
  }

  private fun stopForegroundService(context: Context) {
    try {
      val serviceIntent = Intent(context, CallTrackerService::class.java)
      context.stopService(serviceIntent)
    } catch (error: Exception) {
      Log.w("CallTrackerModule", "stopForegroundService error", error)
    }
  }

  companion object {
    // System writes the CallLog entry shortly after IDLE. 1.8s is a safe delay
    // that works across OEMs without making the upload feel laggy.
    private const val CALLLOG_QUERY_DELAY_MS = 1800L
  }
}
