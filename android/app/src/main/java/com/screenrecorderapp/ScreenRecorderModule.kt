package com.screenrecorderapp

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ScreenRecorderModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val REQUEST_CODE = 1000
        private const val EVENT_RECORDING_STARTED = "onRecordingStarted"
        private const val EVENT_RECORDING_STOPPED = "onRecordingStopped"
        private const val EVENT_RECORDING_ERROR = "onRecordingError"
    }

    private var recordingPromise: Promise? = null
    private var recordingMode: String = "fullscreen" // "fullscreen" or "singleapp"

    override fun getName(): String {
        return "ScreenRecorderModule"
    }

    @ReactMethod
    fun startRecording(mode: String, options: ReadableMap, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity not available")
            return
        }

        recordingMode = mode
        recordingPromise = promise

        try {
            val mediaProjectionManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val captureIntent = mediaProjectionManager.createScreenCaptureIntent()

            activity.startActivityForResult(captureIntent, REQUEST_CODE)
        } catch (e: Exception) {
            promise.reject("START_ERROR", "Failed to start recording: ${e.message}")
            sendEvent(EVENT_RECORDING_ERROR, Arguments.createMap().apply {
                putString("error", e.message)
            })
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            // This will be handled by react-native-record-screen
            promise.resolve(true)
            sendEvent(EVENT_RECORDING_STOPPED, Arguments.createMap())
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop recording: ${e.message}")
        }
    }

    @ReactMethod
    fun pauseRecording(promise: Promise) {
        try {
            // Pause functionality
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", "Failed to pause recording: ${e.message}")
        }
    }

    @ReactMethod
    fun resumeRecording(promise: Promise) {
        try {
            // Resume functionality
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESUME_ERROR", "Failed to resume recording: ${e.message}")
        }
    }

    @ReactMethod
    fun getRecordingMode(promise: Promise) {
        promise.resolve(recordingMode)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for event listeners
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for event listeners
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                recordingPromise?.resolve(true)
                sendEvent(EVENT_RECORDING_STARTED, Arguments.createMap().apply {
                    putString("mode", recordingMode)
                })
            } else {
                recordingPromise?.reject("PERMISSION_DENIED", "Screen recording permission denied")
                sendEvent(EVENT_RECORDING_ERROR, Arguments.createMap().apply {
                    putString("error", "Permission denied")
                })
            }
            recordingPromise = null
        }
    }
}
