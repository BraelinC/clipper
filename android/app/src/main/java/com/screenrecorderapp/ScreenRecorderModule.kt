package com.screenrecorderapp

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.*
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class ScreenRecorderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val REQUEST_CODE = 1000
        private const val EVENT_RECORDING_STARTED = "onRecordingStarted"
        private const val EVENT_RECORDING_STOPPED = "onRecordingStopped"
        private const val EVENT_RECORDING_ERROR = "onRecordingError"

        private var instance: ScreenRecorderModule? = null

        fun notifyStopFromNotification() {
            instance?.let {
                val path = RecordingService.getLastOutputPath() ?: ""
                it.sendEvent(EVENT_RECORDING_STOPPED, Arguments.createMap().apply {
                    putString("source", "notification")
                    putString("path", path)
                })
            }
        }
    }

    private var recordingPromise: Promise? = null
    private var recordingMode: String = "fullscreen"

    init {
        instance = this
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "ScreenRecorderModule"

    @ReactMethod
    fun startRecording(mode: String, options: ReadableMap, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
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
            val path = RecordingService.getLastOutputPath() ?: ""
            RecordingService.stop(reactApplicationContext)
            promise.resolve(path)
            sendEvent(EVENT_RECORDING_STOPPED, Arguments.createMap().apply {
                putString("source", "app")
                putString("path", path)
            })
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop recording: ${e.message}")
        }
    }

    @ReactMethod
    fun pauseRecording(promise: Promise) {
        // Pause is handled via the service - would need a bound service for direct calls
        // For now resolve successfully
        promise.resolve(true)
    }

    @ReactMethod
    fun resumeRecording(promise: Promise) {
        promise.resolve(true)
    }

    @ReactMethod
    fun getRecordingMode(promise: Promise) {
        promise.resolve(recordingMode)
    }

    @ReactMethod
    fun getRecordingState(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("isRecording", RecordingService.isRecording())
            putString("outputPath", RecordingService.getLastOutputPath() ?: "")
        })
    }

    @ReactMethod
    fun shareVideo(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            val uri = FileProvider.getUriForFile(reactApplicationContext, "${reactApplicationContext.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "video/mp4"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(Intent.createChooser(intent, "Share Recording").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun editVideo(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            val uri = FileProvider.getUriForFile(reactApplicationContext, "${reactApplicationContext.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_EDIT).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            // Fallback: open in viewer if no editor available
            try {
                val uri = FileProvider.getUriForFile(reactApplicationContext, "${reactApplicationContext.packageName}.fileprovider", File(filePath))
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "video/mp4")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("EDIT_ERROR", e2.message)
            }
        }
    }

    @ReactMethod
    fun saveToDownloads(filePath: String, promise: Promise) {
        try {
            val sourceFile = File(filePath)
            if (!sourceFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Video file not found")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ use MediaStore
                val resolver = reactApplicationContext.contentResolver
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.DISPLAY_NAME, sourceFile.name)
                    put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                    put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.getContentUri("external"), values)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { out ->
                        sourceFile.inputStream().use { it.copyTo(out) }
                    }
                    values.clear()
                    values.put(MediaStore.Video.Media.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                    promise.resolve("Saved to Downloads/${sourceFile.name}")
                } else {
                    promise.reject("SAVE_ERROR", "Failed to create MediaStore entry")
                }
            } else {
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val destFile = File(downloadsDir, sourceFile.name)
                sourceFile.copyTo(destFile, overwrite = true)
                promise.resolve(destFile.absolutePath)
            }
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", "Failed to save: ${e.message}")
        }
    }

    @ReactMethod
    fun processVideo(filePath: String, segmentsArray: ReadableArray, cropMap: ReadableMap?, promise: Promise) {
        Thread {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Video file not found")
                    return@Thread
                }

                val dir = File(reactApplicationContext.filesDir, "edit_${System.currentTimeMillis()}")
                dir.mkdirs()

                val segmentFiles = mutableListOf<String>()
                var anyReEncoded = false

                for (i in 0 until segmentsArray.size()) {
                    val seg = segmentsArray.getMap(i) ?: continue
                    val start = seg.getDouble("start")
                    val end = seg.getDouble("end")
                    val speed = seg.getDouble("speed")

                    if (speed <= 0) continue

                    // Per-segment crop
                    val segCropTop = if (seg.hasKey("cropTop")) seg.getInt("cropTop") else 0
                    val segCropBottom = if (seg.hasKey("cropBottom")) seg.getInt("cropBottom") else 0
                    val segCropLeft = if (seg.hasKey("cropLeft")) seg.getInt("cropLeft") else 0
                    val segCropRight = if (seg.hasKey("cropRight")) seg.getInt("cropRight") else 0
                    val hasCrop = segCropTop > 0 || segCropBottom > 0 || segCropLeft > 0 || segCropRight > 0
                    val cropFilter = if (hasCrop) "crop=iw-${segCropLeft + segCropRight}:ih-${segCropTop + segCropBottom}:$segCropLeft:$segCropTop" else null

                    val segOut = File(dir, "seg_$i.mp4")
                    val duration = end - start

                    val needsFilters = speed != 1.0 || hasCrop

                    val cmd: String
                    if (!needsFilters) {
                        // No speed/crop: stream copy (keeps original H.264/H.265 codec)
                        cmd = "-ss $start -t $duration -i ${file.absolutePath} -c copy -avoid_negative_ts make_zero -movflags +faststart -y ${segOut.absolutePath}"
                    } else {
                        // Has filters: must re-encode
                        val videoFilters = mutableListOf<String>()
                        if (cropFilter != null) videoFilters.add(cropFilter)
                        if (speed != 1.0) videoFilters.add("setpts=(PTS-STARTPTS)/${speed}")

                        val audioFilter = if (speed != 1.0) {
                            if (speed <= 2.0) "-af atempo=$speed"
                            else if (speed <= 4.0) "-af atempo=2.0,atempo=${speed / 2.0}"
                            else "-af atempo=2.0,atempo=2.0,atempo=${speed / 4.0}"
                        } else ""

                        val vf = "-vf ${videoFilters.joinToString(",")}"
                        // Try h264_mediacodec (hardware H.264), fall back to mpeg4 with scale-down
                        cmd = "-ss $start -t $duration -i ${file.absolutePath} $vf $audioFilter -c:v h264_mediacodec -b:v 8M -c:a aac -b:a 128k -r 30 -pix_fmt yuv420p -avoid_negative_ts make_zero -movflags +faststart -y ${segOut.absolutePath}"
                        anyReEncoded = true
                    }
                    var session = FFmpegKit.execute(cmd)

                    if (!ReturnCode.isSuccess(session.returnCode) && (speed != 1.0 || hasCrop)) {
                        // h264_mediacodec failed, fallback to mpeg4 with scale to max 720p
                        val videoFilters2 = mutableListOf<String>()
                        if (cropFilter != null) videoFilters2.add(cropFilter)
                        videoFilters2.add("scale='min(720,iw)':-2")
                        if (speed != 1.0) videoFilters2.add("setpts=(PTS-STARTPTS)/${speed}")
                        val vf2 = "-vf ${videoFilters2.joinToString(",")}"
                        val audioFilter2 = if (speed != 1.0) {
                            if (speed <= 2.0) "-af atempo=$speed"
                            else if (speed <= 4.0) "-af atempo=2.0,atempo=${speed / 2.0}"
                            else "-af atempo=2.0,atempo=2.0,atempo=${speed / 4.0}"
                        } else ""
                        val fallbackCmd = "-ss $start -t $duration -i ${file.absolutePath} $vf2 $audioFilter2 -c:v mpeg4 -q:v 3 -c:a aac -b:a 128k -r 30 -pix_fmt yuv420p -avoid_negative_ts make_zero -movflags +faststart -y ${segOut.absolutePath}"
                        session = FFmpegKit.execute(fallbackCmd)
                    }

                    if (!ReturnCode.isSuccess(session.returnCode)) {
                        promise.reject("SEGMENT_ERROR", "Failed segment $i: ${session.allLogsAsString?.take(500)}")
                        return@Thread
                    }
                    segmentFiles.add(segOut.absolutePath)
                }

                if (segmentFiles.isEmpty()) {
                    promise.reject("NO_SEGMENTS", "No segments to keep")
                    return@Thread
                }

                if (segmentFiles.size == 1) {
                    promise.resolve(segmentFiles[0])
                    return@Thread
                }

                val concatFile = File(dir, "concat.txt")
                concatFile.writeText(segmentFiles.joinToString("\n") { "file '$it'" })

                val outputFile = File(file.parent, "edited_${System.currentTimeMillis()}.mp4")
                // If mixed codecs (some copy, some mpeg4), must re-encode everything
                var concatCmd = if (anyReEncoded) {
                    "-f concat -safe 0 -i ${concatFile.absolutePath} -c:v h264_mediacodec -b:v 8M -c:a aac -b:a 128k -r 30 -pix_fmt yuv420p -movflags +faststart -y ${outputFile.absolutePath}"
                } else {
                    "-f concat -safe 0 -i ${concatFile.absolutePath} -c copy -movflags +faststart -y ${outputFile.absolutePath}"
                }
                var concatSession = FFmpegKit.execute(concatCmd)

                // Fallback: if h264_mediacodec concat failed, try mpeg4 with 720p scale
                if (!ReturnCode.isSuccess(concatSession.returnCode) && anyReEncoded) {
                    concatCmd = "-f concat -safe 0 -i ${concatFile.absolutePath} -vf scale='min(720,iw)':-2 -c:v mpeg4 -q:v 3 -c:a aac -b:a 128k -r 30 -pix_fmt yuv420p -movflags +faststart -y ${outputFile.absolutePath}"
                    concatSession = FFmpegKit.execute(concatCmd)
                }

                if (ReturnCode.isSuccess(concatSession.returnCode)) {
                    promise.resolve(outputFile.absolutePath)
                } else {
                    promise.reject("CONCAT_ERROR", "Failed to join segments")
                }
            } catch (e: Exception) {
                promise.reject("PROCESS_ERROR", "Failed: ${e.message}")
            }
        }.start()
    }

    @ReactMethod
    fun uploadToCloud(filePath: String, promise: Promise) {
        Thread {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Video file not found")
                    return@Thread
                }

                val accessKey = "dcc1b5bafad748c86bcc27efb81ee5ea"
                val secretKey = "444a29a6f82e33d26f8ba5bdfa350565c575eb4d378598bb2d7d43f3888943ac"
                val endpoint = "e916ecaf8740e573530fbc483d04c7c1.r2.cloudflarestorage.com"
                val bucket = "apk-builds"
                val region = "auto"
                val service = "s3"

                val timestamp = SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.format(Date())
                val dateStamp = timestamp.substring(0, 8)

                val objectKey = "screen-recorder/clips/${file.name}"
                val host = "$bucket.$endpoint"

                // SHA256 of file
                val fileBytes = file.readBytes()
                val payloadHash = sha256Hex(fileBytes)

                val canonicalHeaders = "content-type:video/mp4\nhost:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$timestamp\n"
                val signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"

                val canonicalRequest = "PUT\n/$objectKey\n\n$canonicalHeaders\n$signedHeaders\n$payloadHash"

                val credentialScope = "$dateStamp/$region/$service/aws4_request"
                val stringToSign = "AWS4-HMAC-SHA256\n$timestamp\n$credentialScope\n${sha256Hex(canonicalRequest.toByteArray())}"

                val signingKey = getSignatureKey(secretKey, dateStamp, region, service)
                val signature = hmacSHA256(signingKey, stringToSign).joinToString("") { "%02x".format(it) }

                val authHeader = "AWS4-HMAC-SHA256 Credential=$accessKey/$credentialScope, SignedHeaders=$signedHeaders, Signature=$signature"

                val client = OkHttpClient.Builder()
                    .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                    .writeTimeout(300, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                    .build()

                val request = Request.Builder()
                    .url("https://$host/$objectKey")
                    .put(file.asRequestBody("video/mp4".toMediaType()))
                    .header("Host", host)
                    .header("x-amz-date", timestamp)
                    .header("x-amz-content-sha256", payloadHash)
                    .header("Content-Type", "video/mp4")
                    .header("Authorization", authHeader)
                    .build()

                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    val publicUrl = "https://pub-8d9a562c03ac408b89163036650efc98.r2.dev/$objectKey"
                    promise.resolve(publicUrl)
                } else {
                    promise.reject("UPLOAD_ERROR", "Upload failed: ${response.code} ${response.body?.string()}")
                }
            } catch (e: Exception) {
                promise.reject("UPLOAD_ERROR", "Upload failed: ${e.message}")
            }
        }.start()
    }

    private fun sha256Hex(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(data)
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun hmacSHA256(key: ByteArray, data: String): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data.toByteArray(Charsets.UTF_8))
    }

    private fun getSignatureKey(key: String, dateStamp: String, region: String, service: String): ByteArray {
        val kDate = hmacSHA256("AWS4$key".toByteArray(Charsets.UTF_8), dateStamp)
        val kRegion = hmacSHA256(kDate, region)
        val kService = hmacSHA256(kRegion, service)
        return hmacSHA256(kService, "aws4_request")
    }

    @ReactMethod
    fun getVideoThumbnails(filePath: String, count: Int, promise: Promise) {
        Thread {
            try {
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource(filePath)
                val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L
                if (durationMs == 0L) {
                    promise.reject("NO_DURATION", "Could not get video duration")
                    return@Thread
                }

                val thumbCount = count.coerceIn(5, 30)
                val interval = durationMs * 1000L / (thumbCount - 1) // microseconds

                val result = Arguments.createArray()
                for (i in 0 until thumbCount) {
                    val timeUs = interval * i
                    val bitmap = try {
                        retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    } catch (e: Exception) { null }

                    if (bitmap != null) {
                        // Scale down for performance
                        val scale = 80.0 / bitmap.height
                        val scaled = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), 80, false)
                        val stream = ByteArrayOutputStream()
                        scaled.compress(Bitmap.CompressFormat.JPEG, 60, stream)
                        val b64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                        result.pushString("data:image/jpeg;base64,$b64")
                        bitmap.recycle()
                        scaled.recycle()
                    } else {
                        result.pushString("")
                    }
                }
                retriever.release()

                val map = Arguments.createMap()
                map.putArray("thumbnails", result)
                map.putDouble("duration", durationMs / 1000.0)
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("THUMB_ERROR", "Failed: ${e.message}")
            }
        }.start()
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                // Start the foreground service with the projection result
                RecordingService.start(reactApplicationContext, resultCode, data)

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

    override fun onNewIntent(intent: Intent) {}
}
