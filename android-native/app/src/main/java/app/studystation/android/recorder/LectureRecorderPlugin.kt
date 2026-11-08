package app.studystation.android.recorder

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "LectureRecorder",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone"),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
    ],
)
class LectureRecorderPlugin : Plugin() {

    override fun load() {
        LectureRecordingService.listener = { state, durationMs, recordingId, filePath, error ->
            val data = JSObject()
            data.put("state", state)
            data.put("durationMs", durationMs)
            data.put("recordingId", recordingId)
            data.put("filePath", filePath)
            data.put("errorMessage", error)
            notifyListeners("recordingStateChange", data)

            val duration = JSObject()
            duration.put("durationMs", durationMs)
            notifyListeners("recordingDuration", duration)

            if (error != null && state == "error") {
                val err = JSObject()
                err.put("message", error)
                notifyListeners("recordingError", err)
            }
        }
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        if (!hasMicPermission()) {
            requestPermissionForAlias("microphone", call, "onMicPermission")
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onNotifPermissionStart")
            return
        }
        beginStart(call)
    }

    @PermissionCallback
    private fun onMicPermission(call: PluginCall) {
        if (!hasMicPermission()) {
            call.reject("Microphone permission is required to record lectures.")
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "onNotifPermissionStart")
            return
        }
        beginStart(call)
    }

    @PermissionCallback
    private fun onNotifPermissionStart(call: PluginCall) {
        // Notifications improve UX but recording can still proceed if mic is granted
        beginStart(call)
    }

    private fun beginStart(call: PluginCall) {
        val title = call.getString("title") ?: "Lecture recording"
        val courseId = call.getString("courseId")
        val intent = Intent(context, LectureRecordingService::class.java).apply {
            action = LectureRecordingService.ACTION_START
            putExtra(LectureRecordingService.EXTRA_TITLE, title)
            if (courseId != null) putExtra(LectureRecordingService.EXTRA_COURSE_ID, courseId)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve(statusObject())
    }

    @PluginMethod
    fun pauseRecording(call: PluginCall) {
        context.startService(
            Intent(context, LectureRecordingService::class.java).setAction(LectureRecordingService.ACTION_PAUSE),
        )
        call.resolve(statusObject())
    }

    @PluginMethod
    fun resumeRecording(call: PluginCall) {
        context.startService(
            Intent(context, LectureRecordingService::class.java).setAction(LectureRecordingService.ACTION_RESUME),
        )
        call.resolve(statusObject())
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        context.startService(
            Intent(context, LectureRecordingService::class.java).setAction(LectureRecordingService.ACTION_STOP),
        )
        // Brief delay so service can finalize file — status reflects final path
        val result = statusObject()
        result.put("fileUri", LectureRecordingService.currentFilePath)
        result.put("mimeType", "audio/mp4")
        call.resolve(result)
    }

    @PluginMethod
    fun getRecordingStatus(call: PluginCall) {
        call.resolve(statusObject())
    }

    private fun statusObject(): JSObject {
        val obj = JSObject()
        obj.put("state", LectureRecordingService.currentState)
        obj.put("durationMs", LectureRecordingService.elapsedMs)
        obj.put("recordingId", LectureRecordingService.currentRecordingId)
        obj.put("filePath", LectureRecordingService.currentFilePath)
        obj.put("errorMessage", LectureRecordingService.lastError)
        return obj
    }

    private fun hasMicPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }
}
