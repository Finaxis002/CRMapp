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
    private var isProcessingCallData = false
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

    private var wasRinging = false
    private val MIN_VALID_FILE_SIZE = 10000L

    override fun getName(): String = "CallTrackerModule"

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // ══════════════════════════════════════════════
    // OVERLAY (Note/Task popup during calls)
    // ══════════════════════════════════════════════
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

    // ══════════════════════════════════════════════
    // CALL STATE MACHINE
    // ══════════════════════════════════════════════
    private fun handleCallStateChanged(state: Int, incomingNumber: String? = null) {
        Log.i("CallTracker", "=== STATE CHANGED ===")
        Log.i("CallTracker", "State: $state | wasRinging: $wasRinging | lastState: $lastCallState")

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                wasRinging = true
                currentPhoneNumber = incomingNumber
                currentCallType = "Incoming"
                currentDeviceCallId = UUID.randomUUID().toString()
                callStartTimestamp = System.currentTimeMillis()
                Log.i("CallTracker", "RINGING detected")
            }

            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (!isRecording) {
                    val callType = when (lastCallState) {
                        TelephonyManager.CALL_STATE_RINGING -> "Incoming"
                        else -> "Outgoing"
                    }
                    currentPhoneNumber = incomingNumber ?: currentPhoneNumber
                    currentCallType = callType
                    currentDeviceCallId = UUID.randomUUID().toString()
                    callStartTimestamp = System.currentTimeMillis()
                    startRecordingInternal()
                    startOverlayIfPermitted()
                    Log.i("CallTracker", "OFFHOOK - CallType set to: $callType")
                }
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                if (wasRinging && lastCallState == TelephonyManager.CALL_STATE_RINGING && !isRecording) {
                    currentCallType = "Missed"
                    currentPhoneNumber = incomingNumber ?: currentPhoneNumber
                    if (currentDeviceCallId == null) {
                        currentDeviceCallId = UUID.randomUUID().toString()
                    }
                    if (callStartTimestamp == 0L) {
                        callStartTimestamp = System.currentTimeMillis()
                    }
                    Log.i("CallTracker", ">>> MISSED CALL DETECTED via state machine <<<")
                }

                stopRecordingInternal()
                stopOverlay()
                wasRinging = false
                Log.i("CallTracker", "IDLE - wasRinging reset")
            }
        }
        lastCallState = state
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
                        handleCallStateChanged(state, phoneNumber)
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
                MediaRecorder.AudioSource.MIC
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

    private fun findAndCopyNativeRecording(phoneNumber: String?, durationSec: Int, callEndTimeSec: Long): String? {
        val searchStart = callEndTimeSec - 45
        val searchEnd = callEndTimeSec + 30

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

            cursor?.use {
                val cleanPhone = phoneNumber?.replace("\\D".toRegex(), "")?.takeLast(10)
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media._ID))
                    val title = it.getString(it.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)) ?: ""
                    val durationMs = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION))
                    val fileSize = it.getLong(it.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE))

                    val uri = Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id.toString())

                    if (fileSize < MIN_VALID_FILE_SIZE) continue

                    if (cleanPhone != null && cleanPhone.length >= 5 && title.contains(cleanPhone)) {
                        bestMatchUri = uri
                        break
                    }

                    if (bestMatchUri == null && durationSec > 0) {
                        val durationSecFromMedia = durationMs / 1000
                        val diff = Math.abs(durationSecFromMedia - durationSec)
                        if (diff <= 4) {
                            bestMatchUri = uri
                        }
                    }
                }
            }

            if (bestMatchUri != null) {
                return copyNativeFileToCache(bestMatchUri)
            }
        } catch (e: Exception) {
            Log.e("NativeSearch", "Search failed", e)
        }
        return null
    }

    private fun copyNativeFileToCache(uri: Uri): String? {
        try {
            val contentResolver = reactContext.contentResolver
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

            if (actualFileSize < MIN_VALID_FILE_SIZE) return null

            val mimeType = contentResolver.getType(uri)
            val extension = when {
                title.endsWith(".amr", ignoreCase = true) -> ".amr"
                title.endsWith(".3gp", ignoreCase = true) -> ".3gp"
                title.endsWith(".mp3", ignoreCase = true) -> ".mp3"
                title.endsWith(".m4a", ignoreCase = true) -> ".m4a"
                else -> ".m4a"
            }

            val tempFile = File(reactContext.cacheDir, "native_rec_${UUID.randomUUID()}$extension")

            contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output)
                }
            }

            if (tempFile.length() < MIN_VALID_FILE_SIZE) {
                tempFile.delete()
                return null
            }

            return tempFile.absolutePath
        } catch (e: Exception) {
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
            Log.w("CallTracker", "Stop recorder error", error)
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

        if (isProcessingCallData) {
            Log.w("CallTracker", "Already processing a call lifecycle. Skipping duplicate trigger.")
            return
        }

        isProcessingCallData = true

        Handler(Looper.getMainLooper()).postDelayed({
            processCallData(
                appFilePath = appRecordingPath,
                deviceCallId = capturedDeviceCallId,
                provisionalCallType = provisionalCallType,
                fallbackTimestamp = capturedStartTs,
                attempt = 1
            )
        }, 5000L)
    }

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

        try {
            val cursor = reactContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DURATION, CallLog.Calls.DATE),
                null, null, "${CallLog.Calls.DATE} DESC"
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
                        5 -> "Rejected"
                        else -> provisionalCallType
                    }

                    if (callType == "Incoming" && durationSeconds == 0) {
                        callType = "Missed"
                    }
                    if (callType == "Outgoing" && durationSeconds == 0) {
                        callType = "No Answer"
                    }
                }
            }
        } catch (error: Exception) {
            Log.w("CallTracker", "CallLog query failed", error)
        }

        Log.i("CallTracker", "Processing data. Attempt: $attempt | Current callType: $callType")

        if (callType == "Missed" || callType == "No Answer") {
            Log.i("CallTracker", "$callType call detected. Stopping loop and dispatching empty payload.")
            emitFinalPayload(null, number, callType, durationSeconds, callTimestamp, deviceCallId)
            return
        }

        val appFile = appFilePath?.let { File(it) }
        val callEndTimeSec = (callTimestamp / 1000) + durationSeconds
        val nativePath = findAndCopyNativeRecording(number, durationSeconds, callEndTimeSec)

        var finalRecordingPath: String? = null

        if (nativePath != null) {
            finalRecordingPath = nativePath
            if (appFilePath != null) {
                try { File(appFilePath).delete() } catch (_: Exception) {}
            }
            emitFinalPayload(finalRecordingPath, number, callType, durationSeconds, callTimestamp, deviceCallId)
        } else {
            if (attempt < 8) {
                val nextDelay = 2000L * attempt
                Log.w("NativeSearch", "Recording not found yet. Rescheduling attempt ${attempt + 1} in ${nextDelay}ms")
                Handler(Looper.getMainLooper()).postDelayed({
                    processCallData(appFilePath, deviceCallId, provisionalCallType, fallbackTimestamp, attempt + 1)
                }, nextDelay)
            } else {
                Log.w("NativeSearch", "Max backoff attempts exhausted.")
                if (appFile?.exists() == true && appFile.length() >= 20000) {
                    finalRecordingPath = appFilePath
                } else {
                    try { appFile?.delete() } catch (_: Exception) {}
                }
                emitFinalPayload(finalRecordingPath, number, callType, durationSeconds, callTimestamp, deviceCallId)
            }
        }
    }

    private fun emitFinalPayload(
        filePath: String?,
        number: String?,
        callType: String,
        duration: Int,
        timestamp: Long,
        deviceCallId: String?
    ) {
        val payload = Arguments.createMap().apply {
            putString("recordingFilePath", filePath)
            putBoolean("recordingAvailable", !filePath.isNullOrBlank())
            putString("phoneNumber", number ?: "")
            putString("callType", callType)
            putInt("duration", duration)
            putDouble("callTimestamp", timestamp.toDouble())
            putString("deviceCallId", deviceCallId)
        }

        sendEvent("CallRecordingCompleted", payload)
        isProcessingCallData = false
        Log.i("CallTracker", "=== FINISHED LIFECYCLE: Event Dispatched successfully ===")
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