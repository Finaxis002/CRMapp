package com.shardacrm

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactApplication
import java.util.Calendar

class CallOverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var currentPhoneNumber: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            android.util.Log.i("CallOverlayService", "onCreate() called")
        } catch (e: Exception) {
            android.util.Log.e("CallOverlayService", "onCreate crashed", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        currentPhoneNumber = intent?.getStringExtra("phoneNumber")

        if (currentPhoneNumber.isNullOrBlank()) {
            val prefs = getSharedPreferences("call_tracker_prefs", MODE_PRIVATE)
            currentPhoneNumber = prefs.getString("current_phone_number", "")?.takeIf { it.isNotBlank() }
        }

        try {
            android.util.Log.i("CallOverlayService", "onStartCommand() called - attempting showOverlay")
            if (overlayView == null) {
                showOverlay()
            }
        } catch (e: Exception) {
            android.util.Log.e("CallOverlayService", "onStartCommand crashed", e)
        }

        return START_STICKY
    }

    private fun showOverlay() {
        if (overlayView != null) return

        try {
            windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
            val inflater = LayoutInflater.from(this)
            val view = inflater.inflate(R.layout.call_overlay_bar, null)
            overlayView = view

            val overlayType =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
            
            params.gravity = Gravity.TOP or Gravity.START
            params.x = 0
            params.y = 200

            val bubbleView = view.findViewById<View>(R.id.bubbleView)
            val actionPillView = view.findViewById<View>(R.id.actionPillView)
            val expandedForm = view.findViewById<View>(R.id.expandedForm)

            val btnCollapseToBubble = view.findViewById<View>(R.id.btnCollapseToBubble)
            val formTitle = view.findViewById<TextView>(R.id.formTitle)
            val inputText = view.findViewById<EditText>(R.id.inputText)
            val btnNote = view.findViewById<Button>(R.id.btnNote)
            val btnTask = view.findViewById<Button>(R.id.btnTask)
            val btnNewLead = view.findViewById<Button>(R.id.btnNewLead)
            val btnClose = view.findViewById<ImageButton>(R.id.btnClose)
            val btnCancel = view.findViewById<Button>(R.id.btnCancel)
            val btnSave = view.findViewById<Button>(R.id.btnSave)
            val btnPickDate = view.findViewById<Button>(R.id.btnPickDate)

            var currentType = "Note"
            var selectedDueDate = ""

            fun getTodayDateString(): String {
                val c = Calendar.getInstance()
                return String.format("%d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
            }

            selectedDueDate = getTodayDateString()

            var initialX = 0
            var initialY = 200 // Store initial Y offset so it collapses correctly
            var initialTouchX = 0f
            var initialTouchY = 0f

            bubbleView.setOnTouchListener { v, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX + (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager?.updateViewLayout(overlayView, params)
                        true
                    }
                    MotionEvent.ACTION_UP -> {
                        val diffX = Math.abs(event.rawX - initialTouchX)
                        val diffY = Math.abs(event.rawY - initialTouchY)
                        if (diffX < 10 && diffY < 10) {
                            v.performClick()
                        }
                        true
                    }
                    else -> false
                }
            }

            fun setFocusable(focusable: Boolean) {
                if (focusable) {
                    params.flags = params.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
                } else {
                    params.flags = params.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                }
                try { windowManager?.updateViewLayout(overlayView, params) } catch (_: Exception) {}
            }

            bubbleView.setOnClickListener {
                bubbleView.visibility = View.GONE
                actionPillView.visibility = View.VISIBLE
            }

            btnCollapseToBubble.setOnClickListener {
                actionPillView.visibility = View.GONE
                bubbleView.visibility = View.VISIBLE
            }

            fun expandForm(type: String) {
                currentType = type
                actionPillView.visibility = View.GONE
                
                // When expanding the form, we reset the layout to take full width
                // and position it at the top so it doesn't get cut off when the keyboard appears.
                params.width = WindowManager.LayoutParams.MATCH_PARENT
                params.x = 0
                params.y = 0
                
                expandedForm.visibility = View.VISIBLE
                formTitle.text = "Add $type"

                if (type == "Note") {
                    inputText.hint = "Enter call notes..."
                    btnPickDate.visibility = View.GONE
                } else if (type == "Lead") {
                    inputText.hint = "Enter lead name..."
                    btnPickDate.visibility = View.GONE
                } else {
                    inputText.hint = "Enter task description..."
                    selectedDueDate = getTodayDateString()
                    btnPickDate.text = "Due: Today"
                    btnPickDate.visibility = View.VISIBLE
                }

                inputText.setText("")
                setFocusable(true)
                inputText.requestFocus()
            }

            fun collapseForm() {
                expandedForm.visibility = View.GONE
                bubbleView.visibility = View.VISIBLE
                
                // When collapsing back to the bubble, revert to wrap_content
                // and restore the previous dragged coordinates.
                params.width = WindowManager.LayoutParams.WRAP_CONTENT
                params.x = initialX
                params.y = initialY
                
                inputText.clearFocus()
                setFocusable(false)
            }

            btnNote.setOnClickListener { expandForm("Note") }
            btnTask.setOnClickListener { expandForm("Task") }
            btnNewLead.setOnClickListener { expandForm("Lead") }

            btnCancel.setOnClickListener { collapseForm() }

            btnClose.setOnClickListener {
                emitOverlayCloseRequested()
                stopSelf()
            }

            btnSave.setOnClickListener {
                val text = inputText.text.toString().trim()
                if (text.isNotEmpty()) {
                    when (currentType) {
                        "Task" -> emitOverlaySubmit("Task|$selectedDueDate", text)
                        "Lead" -> emitOverlayLeadSubmit(text)
                        else -> emitOverlaySubmit("Note", text)
                    }
                }
                collapseForm()
            }

            btnPickDate.setOnClickListener {
                val calendar = Calendar.getInstance()
                val datePickerDialog = android.app.DatePickerDialog(
                    this,
                    { _, year, month, dayOfMonth ->
                        selectedDueDate = String.format("%d-%02d-%02d", year, month + 1, dayOfMonth)
                        btnPickDate.text = "Due: $selectedDueDate"
                    },
                    calendar.get(Calendar.YEAR),
                    calendar.get(Calendar.MONTH),
                    calendar.get(Calendar.DAY_OF_MONTH)
                )

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    datePickerDialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
                } else {
                    @Suppress("DEPRECATION") datePickerDialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
                }
                datePickerDialog.show()
            }

            windowManager?.addView(view, params)
            android.util.Log.i("CallOverlayService", "Overlay view added successfully")

        } catch (e: Exception) {
            android.util.Log.e("CallOverlayService", "showOverlay failed", e)
            overlayView = null
        }
    }

    private fun emitOverlaySubmit(type: String, text: String) {
        try {
            val app = application as ReactApplication
            val reactContext = app.reactHost?.currentReactContext
            if (reactContext == null) {
                android.util.Log.w("CallOverlayService", "reactContext is null, cannot emit event")
                return
            }
            val payload = Arguments.createMap().apply {
                putString("type", type)
                putString("text", text)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("OverlayNoteSubmitted", payload)
            android.util.Log.i("CallOverlayService", "Event emitted successfully: $type")
        } catch (e: Exception) {
            android.util.Log.w("CallOverlayService", "emit failed", e)
        }
    }

    private fun emitOverlayLeadSubmit(name: String) {
        try {
            val app = application as ReactApplication
            val reactContext = app.reactHost?.currentReactContext
            if (reactContext == null) {
                android.util.Log.w("CallOverlayService", "reactContext is null, cannot emit lead event")
                return
            }
            val payload = Arguments.createMap().apply {
                putString("type", "Lead")
                putString("text", name)
                putString("phoneNumber", currentPhoneNumber ?: "")
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("OverlayLeadSubmitted", payload)
            android.util.Log.i("CallOverlayService", "Lead event emitted")
        } catch (e: Exception) {
            android.util.Log.w("CallOverlayService", "lead emit failed", e)
        }
    }

    private fun emitOverlayCloseRequested() {
        try {
            val app = application as ReactApplication
            val reactContext = app.reactHost?.currentReactContext
            if (reactContext == null) {
                android.util.Log.w("CallOverlayService", "reactContext is null, cannot emit close event")
                return
            }
            val payload = Arguments.createMap().apply {
                putString("phoneNumber", currentPhoneNumber ?: "")
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("OverlayCloseRequested", payload)
            android.util.Log.i("CallOverlayService", "Close event emitted")
        } catch (e: Exception) {
            android.util.Log.w("CallOverlayService", "close event emit failed", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            overlayView?.let { windowManager?.removeView(it) }
        } catch (_: Exception) {}
        overlayView = null
    }
}
