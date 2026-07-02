package com.shardacrm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.MediaStore
import android.provider.Settings
import android.media.MediaRecorder
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class CallTrackerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var recorder: MediaRecorder? = null
  private var isRecording = false
  private var outputFilePath: String? = null
  private var phoneStateListener: PhoneStateListener? = null
  private var telephonyCallback: Any? = null 
  private var telephonyManager: TelephonyManager? = null
  private var currentPhoneNumber: String? = null
  private var currentCallType: String? = null
  private var currentDeviceCallId: String? = null
  private var callStartTimestamp: Long = 0L
  private var lastCallState = TelephonyManager.CALL_STATE_IDLE
  private var currentAudioSource: Int = MediaRecorder.AudioSource.MIC

  private val MIN_VALID_FILE_SIZE = 5000L

  override fun getName(): String = "CallTrackerModule"

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap?) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }

  private fun handleCallStateChanged(state: Int) {
    when (state) {
      TelephonyManager.CALL_STATE_OFFHOOK -> {
        if (!isRecording) {
          val callType = when (lastCallState) {
            TelephonyManager.CALL_STATE_RINGING -> "Incoming"
            else -> "Outgoing"
          }
          currentPhoneNumber = null
          currentCallType = callType
          currentDeviceCallId = UUID.randomUUID().toString()
          callStartTimestamp = System.currentTimeMillis()
          startRecordingInternal()
          startOverlayIfPermitted()
        }
      }
      TelephonyManager.CALL_STATE_IDLE -> {
        stopRecordingInternal()
        stopOverlay()
      }
    }
    lastCallState = state
  }

private fun startOverlayIfPermitted() {
    try {
      val context = reactContext.applicationContext
      val canDraw =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context)
        else true

      Log.i("CallTracker", "canDraw = $canDraw")

      if (canDraw) {
        val name = context.startService(Intent(context, CallOverlayService::class.java))
        Log.i("CallTracker", "startService() returned: $name")
      } else {
        Log.w("CallTracker", "Overlay permission not granted, skipping overlay")
      }
    } catch (e: Exception) {
      Log.e("CallTracker", "startOverlayIfPermitted crashed", e)
    }
}

  private fun stopOverlay() {
    try {
      val context = reactContext.applicationContext
      context.stopService(Intent(context, CallOverlayService::class.java))
    } catch (e: Exception) {
      Log.w("CallTracker", "stopOverlay failed", e)
    }
  }

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    try {
      val context = reactContext.applicationContext
      val granted =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context)
        else true
      promise.resolve(granted)
    } catch (e: Exception) {
      promise.reject("CHECK_FAILED", e)
    }
  }

  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    try {
      val context = reactContext.applicationContext
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("REQUEST_FAILED", e)
    }
  }

  @ReactMethod
  fun initCallTracker(promise: Promise) {
    try {
      val context = reactContext.applicationContext
      telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { 
        telephonyCallback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
          override fun onCallStateChanged(state: Int) {
            handleCallStateChanged(state)
          }
        }
      } else {
        phoneStateListener = object : PhoneStateListener() {
          override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            handleCallStateChanged(state)
          }
        }
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("INIT_FAILED", error)
    }
  }

  @ReactMethod
  fun startCallTracker(promise: Promise) {
    try {
      if (telephonyManager == null) {
        initCallTracker(promise)
        return
      }
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        telephonyCallback?.let {
          telephonyManager?.registerTelephonyCallback(reactContext.mainExecutor, it as TelephonyCallback)
        }
      } else {
        phoneStateListener?.let {
          telephonyManager?.listen(it, PhoneStateListener.LISTEN_CALL_STATE)
        }
      }
      startForegroundService(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("START_FAILED", error)
    }
  }

  @ReactMethod
  fun stopCallTracker(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        telephonyCallback?.let {
          telephonyManager?.unregisterTelephonyCallback(it as TelephonyCallback)
        }
      } else {
        telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
      }
      
      stopRecordingInternal()
      stopForegroundService(reactContext.applicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("STOP_FAILED", error)
    }
  }

  private fun startRecordingInternal() {
    try {
      val outputDir = reactContext.cacheDir
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
          Log.i("NativeSearch", "App recording started with source: $source")
          break
        } catch (error: Exception) {
          recorder = null
        }
      }
      if (!started) {
        outputFilePath = null
        isRecording = false
      }
    } catch (error: Exception) {
      isRecording = false
    }
  }

  // Logic: Find Native Recording
  private fun findAndCopyNativeRecording(phoneNumber: String?, durationSec: Int, callEndTimeSec: Long): String? {
      val searchStart = callEndTimeSec - 60
      val searchEnd = callEndTimeSec + 30

      Log.d("NativeSearch", "Searching MediaStore from $searchStart to $searchEnd sec")
      
      val projection = arrayOf(
          MediaStore.Audio.Media._ID,
          MediaStore.Audio.Media.TITLE,
          MediaStore.Audio.Media.DURATION, 
          MediaStore.Audio.Media.DATE_MODIFIED, 
          MediaStore.Audio.Media.MIME_TYPE,
          MediaStore.Audio.Media.SIZE
      )
      
      val selection = "${MediaStore.Audio.Media.DATE_MODIFIED} >= ? AND ${MediaStore.Audio.Media.DATE_MODIFIED} <= ?"
      val selectionArgs = arrayOf(searchStart.toString(), searchEnd.toString())
      val sortOrder = "${MediaStore.Audio.Media.DATE_MODIFIED} DESC" 
      
      try {
          val cursor = reactContext.contentResolver.query(
              MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
              projection,
              selection, 
              selectionArgs,
              sortOrder
          )
          
          var bestMatchUri: Uri? = null

          if (cursor != null) {
              Log.d("NativeSearch", "Found ${cursor.count} audio files in time window.")
          }
          
          cursor?.use {
              val cleanPhone = phoneNumber?.replace("\\D".toRegex(), "")?.takeLast(10)

              while (it.moveToNext()) {
                  val id = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID))
                  val title = it.getString(it.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)) ?: ""
                  val durationMs = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION))
                  val fileSize = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE))
                  
                  val uri = Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id.toString())
                  
                  // CRITICAL: Skip files that are too small (still being written by dialer)
                  if (fileSize < MIN_VALID_FILE_SIZE) {
                      Log.w("NativeSearch", "⏳ Skipping '$title' - file too small ($fileSize bytes). Still locked.")
                      continue
                  }
                  
                  // MATCH 1: Phone Number Check (Highest Priority)
                  if (cleanPhone != null && cleanPhone.length >= 5 && title.contains(cleanPhone)) {
                      Log.i("NativeSearch", "✅ MATCH FOUND BY PHONE NUMBER: $title (size: $fileSize bytes)")
                      bestMatchUri = uri
                      break 
                  }
                  
                  // MATCH 2: Strict Duration Check (within 3 seconds for high confidence)
                  if (bestMatchUri == null && durationSec > 0) {
                      val durationSecFromMedia = durationMs / 1000
                      val diff = Math.abs(durationSecFromMedia - durationSec)
                      
                      if (diff <= 3) { 
                          Log.i("NativeSearch", "✅ MATCH FOUND BY DURATION: $title (size: $fileSize bytes)")
                          bestMatchUri = uri
                      }
                  }
              }
          }
          
          if (bestMatchUri != null) {
              return copyNativeFileToCache(bestMatchUri!!)
          } else {
              Log.w("NativeSearch", "No matching native file found (or all files still locked).")
          }

      } catch (e: Exception) {
          Log.e("NativeSearch", "Search failed", e)
      }
      return null
  }

  // FIX: Verify file is fully written before copy + correct extension detection
  private fun copyNativeFileToCache(uri: Uri): String? {
      try {
          val contentResolver = reactContext.contentResolver
          
          // 1. CRITICAL FIX: Pre-flight check — is the file fully written?
          var actualFileSize = 0L
          var title = ""
          
          val infoCursor = contentResolver.query(
              uri, 
              arrayOf(MediaStore.Audio.Media.SIZE, MediaStore.Audio.Media.TITLE), 
              null, null, null
          )
          infoCursor?.use {
              if (it.moveToFirst()) {
                  actualFileSize = it.getLong(0)
                  title = it.getString(1) ?: ""
              }
          }

          if (actualFileSize < MIN_VALID_FILE_SIZE) {
              Log.w("NativeSearch", "⏳ File '$title' is too small ($actualFileSize bytes). Dialer still writing. Returning null to trigger retry.")
              return null
          }

          val mimeType = contentResolver.getType(uri)
          Log.d("NativeSearch", "Detected MIME: $mimeType | Title: $title | Size: $actualFileSize bytes")
          
          // 2. Extension Detection (Title first, then MIME)
          val extension = when {
              title.endsWith(".amr", ignoreCase = true) -> ".amr"
              title.endsWith(".3gpp", ignoreCase = true) -> ".3gp"
              title.endsWith(".3gp", ignoreCase = true) -> ".3gp"
              title.endsWith(".mp3", ignoreCase = true) -> ".mp3"
              title.endsWith(".wav", ignoreCase = true) -> ".wav"
              title.endsWith(".ogg", ignoreCase = true) -> ".ogg"
              title.endsWith(".m4a", ignoreCase = true) -> ".m4a"
              title.endsWith(".aac", ignoreCase = true) -> ".aac"
              // MIME fallback
              mimeType == "audio/amr" || mimeType == "audio/amr-wb" -> ".amr"
              mimeType == "audio/3gpp" || mimeType == "audio/3gpp2" -> ".3gp"
              mimeType == "audio/mpeg" -> ".mp3"
              mimeType == "audio/wav" || mimeType == "audio/x-wav" -> ".wav"
              mimeType == "audio/ogg" -> ".ogg"
              mimeType == "audio/aac" -> ".aac"
              else -> ".m4a"
          }

          val tempFile = File(reactContext.cacheDir, "native_rec_${UUID.randomUUID()}$extension")
          
          contentResolver.openInputStream(uri)?.use { inputStream ->
              FileOutputStream(tempFile).use { outputStream ->
                  inputStream.copyTo(outputStream)
                  outputStream.flush()
              }
          }
          
          // 3. POST-COPY VERIFICATION: ensure full copy
          val copiedSize = tempFile.length()
          if (copiedSize < MIN_VALID_FILE_SIZE) {
              Log.w("NativeSearch", "❌ Copy resulted in tiny file ($copiedSize bytes). Deleting.")
              tempFile.delete()
              return null
          }

          // Optional: size mismatch warning (within 5% tolerance)
          if (Math.abs(copiedSize - actualFileSize) > actualFileSize * 0.05) {
              Log.w("NativeSearch", "⚠️ Size mismatch! Original: $actualFileSize, Copied: $copiedSize")
          }

          Log.i("NativeSearch", "✅ Successfully copied native file as $extension ($copiedSize bytes)")
          return tempFile.absolutePath

      } catch (e: Exception) {
          Log.e("NativeSearch", "Copy failed", e)
          return null
      }
  }

  private fun stopRecordingInternal() {
    var appRecordingPath: String? = null
    try {
      if (isRecording) {
        recorder?.stop()
      }
    } catch (error: Exception) {
      // Ignore
    } finally {
      try { recorder?.release() } catch (_: Exception) {}
      recorder = null
      isRecording = false
      appRecordingPath = outputFilePath
      outputFilePath = null
    }

    val capturedDeviceCallId = currentDeviceCallId
    val capturedStartTs = callStartTimestamp
    val provisionalCallType = currentCallType ?: "Outgoing"
    
    currentPhoneNumber = null
    currentCallType = null
    currentDeviceCallId = null
    callStartTimestamp = 0L

    // Initial wait — give dialer time to flush file to disk
    Handler(Looper.getMainLooper()).postDelayed({
      processCallData(
        appFilePath = appRecordingPath,
        deviceCallId = capturedDeviceCallId,
        provisionalCallType = provisionalCallType,
        fallbackTimestamp = capturedStartTs,
        attempt = 1
      )
    }, 6000L) 
  }

  // Recursive retry with progressive backoff
  private fun processCallData(
    appFilePath: String?,
    deviceCallId: String?,
    provisionalCallType: String,
    fallbackTimestamp: Long,
    attempt: Int
  ) {
    var number: String? = null
    var callType = provisionalCallType
    var durationSeconds = 0
    var callTimestamp = fallbackTimestamp
    var finalRecordingPath: String? = null

    // 1. Get Call Log
    try {
      val cursor = reactContext.contentResolver.query(
        CallLog.Calls.CONTENT_URI,
        arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DURATION, CallLog.Calls.DATE),
        null, null, "${CallLog.Calls.DATE} DESC",
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
            else -> provisionalCallType
          }
        }
      }
    } catch (error: Exception) {
      Log.w("CallTracker", "CallLog query failed", error)
    }

    // 2. App File Check
    val appFile = appFilePath?.let { File(it) }

    // 3. ALWAYS TRY NATIVE FALLBACK FIRST (Because Android 10+ Internal Recording is often silent)
    Log.i("NativeSearch", "Attempt $attempt: Searching for native recording (ignoring internal file for now)...")
    val callEndTimeSec = (callTimestamp / 1000) + durationSeconds
    val nativePath = findAndCopyNativeRecording(number, durationSeconds, callEndTimeSec)
    
    if (nativePath != null) {
        // Native recording found! This will have the actual audio.
        finalRecordingPath = nativePath
        
        // Delete the silent internal app file to save space
        if (appFilePath != null) {
            try { File(appFilePath).delete() } catch(_: Exception) {}
        }
    } else {
        // Retry logic if native file not found yet
        if (attempt < 5) {
            // Progressive backoff: 2s, 3s, 4s, 5s
            val nextDelay = (1000L + (attempt * 1000L))
            Log.w("NativeSearch", "Attempt $attempt failed. Retrying in ${nextDelay}ms...")
            Handler(Looper.getMainLooper()).postDelayed({
               processCallData(appFilePath, deviceCallId, provisionalCallType, fallbackTimestamp, attempt + 1)
            }, nextDelay)
            return
        } else {
            Log.w("NativeSearch", "Max attempts (5) reached. No native file found.")
            
            // Only if ALL native fallback attempts fail, we consider the internal recording
            if (appFile?.exists() == true) {
                if (appFile.length() < 20000) {
                    Log.w("NativeSearch", "Internal file is too small/silent (<20KB). Discarding.")
                    finalRecordingPath = null
                    try { appFile.delete() } catch(_: Exception) {}
                } else {
                    Log.w("NativeSearch", "Using internal app file as last resort.")
                    finalRecordingPath = appFilePath
                }
            }
        }
    }

    // 4. Emit to JS
    val payload = Arguments.createMap().apply {
      putString("recordingFilePath", finalRecordingPath)
      putBoolean("recordingAvailable", !finalRecordingPath.isNullOrBlank())
      putString("phoneNumber", number ?: "")
      putString("callType", callType)
      putInt("duration", durationSeconds)
      putDouble("callTimestamp", callTimestamp.toDouble())
      putString("deviceCallId", deviceCallId)
    }
    
    sendEvent("CallRecordingCompleted", payload)
  }

  private fun startForegroundService(context: Context) {
    try {
      val serviceIntent = Intent(context, CallTrackerService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(serviceIntent)
      else context.startService(serviceIntent)
    } catch (e: Exception) { Log.w("CallTracker", "StartService error", e) }
  }

  private fun stopForegroundService(context: Context) {
    try {
      val serviceIntent = Intent(context, CallTrackerService::class.java)
      context.stopService(serviceIntent)
    } catch (e: Exception) { Log.w("CallTracker", "StopService error", e) }
  }
}