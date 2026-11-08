package app.studystation.android.recorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * Foreground microphone service for lecture capture while the screen is off
 * or the user switches apps.
 */
class LectureRecordingService : Service() {

    companion object {
        const val CHANNEL_ID = "studystation_lecture_recording"
        const val NOTIFICATION_ID = 7101

        const val ACTION_START = "app.studystation.android.recorder.START"
        const val ACTION_PAUSE = "app.studystation.android.recorder.PAUSE"
        const val ACTION_RESUME = "app.studystation.android.recorder.RESUME"
        const val ACTION_STOP = "app.studystation.android.recorder.STOP"

        const val EXTRA_TITLE = "title"
        const val EXTRA_COURSE_ID = "courseId"

        @Volatile var currentState: String = "idle"
            private set
        @Volatile var currentRecordingId: String? = null
            private set
        @Volatile var currentFilePath: String? = null
            private set
        @Volatile var elapsedMs: Long = 0
            private set
        @Volatile var lastError: String? = null
            private set

        var listener: ((state: String, durationMs: Long, recordingId: String?, filePath: String?, error: String?) -> Unit)? = null

        fun emit() {
            listener?.invoke(currentState, elapsedMs, currentRecordingId, currentFilePath, lastError)
        }
    }

    private var recorder: MediaRecorder? = null
    private var recordingId: String? = null
    private var outputFile: File? = null
    private var baseElapsedMs: Long = 0
    private var segmentStartedAt: Long = 0
    private var isPaused: Boolean = false
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var tickFuture: ScheduledFuture<*>? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "Lecture recording"
                startRecordingInternal(title)
            }
            ACTION_PAUSE -> pauseRecordingInternal()
            ACTION_RESUME -> resumeRecordingInternal()
            ACTION_STOP -> stopRecordingInternal(stopService = true)
            else -> {
                // Service restarted by system — attempt recovery metadata only
                startForeground(NOTIFICATION_ID, buildNotification("Recovering…", 0))
            }
        }
        return START_STICKY
    }

    private fun startRecordingInternal(title: String) {
        if (currentState == "recording" || currentState == "paused") return
        lastError = null
        recordingId = UUID.randomUUID().toString()
        val dir = File(filesDir, "recordings/${recordingId}").apply { mkdirs() }
        outputFile = File(dir, "lecture.m4a")
        baseElapsedMs = 0
        isPaused = false

        try {
            val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mr.setAudioSource(MediaRecorder.AudioSource.MIC)
            mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mr.setAudioEncodingBitRate(128_000)
            mr.setAudioSamplingRate(44_100)
            mr.setOutputFile(outputFile!!.absolutePath)
            mr.prepare()
            mr.start()
            recorder = mr
            segmentStartedAt = SystemClock.elapsedRealtime()
            currentState = "recording"
            currentRecordingId = recordingId
            currentFilePath = outputFile!!.absolutePath
            startForeground(NOTIFICATION_ID, buildNotification("Recording", 0))
            startTicker()
            emit()
            persistMeta(title)
        } catch (e: Exception) {
            lastError = e.message ?: "Could not start recording"
            currentState = "error"
            emit()
            stopSelf()
        }
    }

    private fun pauseRecordingInternal() {
        val mr = recorder ?: return
        if (currentState != "recording") return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mr.pause()
                baseElapsedMs += SystemClock.elapsedRealtime() - segmentStartedAt
                isPaused = true
                currentState = "paused"
                elapsedMs = baseElapsedMs
                updateNotification("Paused", elapsedMs)
                emit()
            } else {
                lastError = "Pause requires Android 7+"
                emit()
            }
        } catch (e: Exception) {
            lastError = e.message
            emit()
        }
    }

    private fun resumeRecordingInternal() {
        val mr = recorder ?: return
        if (currentState != "paused") return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mr.resume()
                segmentStartedAt = SystemClock.elapsedRealtime()
                isPaused = false
                currentState = "recording"
                updateNotification("Recording", baseElapsedMs)
                emit()
            }
        } catch (e: Exception) {
            lastError = e.message
            emit()
        }
    }

    private fun stopRecordingInternal(stopService: Boolean) {
        tickFuture?.cancel(true)
        tickFuture = null
        try {
            if (!isPaused && currentState == "recording") {
                baseElapsedMs += SystemClock.elapsedRealtime() - segmentStartedAt
            }
            recorder?.apply {
                try { stop() } catch (_: Exception) {}
                try { release() } catch (_: Exception) {}
            }
        } catch (_: Exception) {
        }
        recorder = null
        elapsedMs = baseElapsedMs
        currentState = "idle"
        // Keep file path and id for upload handoff
        emit()
        if (stopService) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun startTicker() {
        tickFuture?.cancel(true)
        tickFuture = scheduler.scheduleAtFixedRate({
            if (currentState == "recording" && !isPaused) {
                elapsedMs = baseElapsedMs + (SystemClock.elapsedRealtime() - segmentStartedAt)
                updateNotification("Recording", elapsedMs)
                emit()
            }
        }, 1, 1, TimeUnit.SECONDS)
    }

    private fun persistMeta(title: String) {
        try {
            val meta = File(filesDir, "recordings/${recordingId}/meta.json")
            meta.writeText(
                """{"id":"$recordingId","title":${jsonString(title)},"path":${jsonString(outputFile!!.absolutePath)},"state":"$currentState"}"""
            )
        } catch (_: Exception) {
        }
    }

    private fun jsonString(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Lecture recording",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Shows while StudyStation is recording a lecture"
                setSound(null, null)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(status: String, durationMs: Long): Notification {
        val pauseIntent = PendingIntent.getService(
            this, 1,
            Intent(this, LectureRecordingService::class.java).setAction(ACTION_PAUSE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val resumeIntent = PendingIntent.getService(
            this, 2,
            Intent(this, LectureRecordingService::class.java).setAction(ACTION_RESUME),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this, 3,
            Intent(this, LectureRecordingService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StudyStation")
            .setContentText("$status · ${formatDuration(durationMs)}")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (currentState == "paused") {
            builder.addAction(0, "Resume", resumeIntent)
        } else {
            builder.addAction(0, "Pause", pauseIntent)
        }
        builder.addAction(0, "Stop", stopIntent)
        return builder.build()
    }

    private fun updateNotification(status: String, durationMs: Long) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(status, durationMs))
    }

    private fun formatDuration(ms: Long): String {
        val totalSec = (ms / 1000).toInt()
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }

    override fun onDestroy() {
        tickFuture?.cancel(true)
        scheduler.shutdownNow()
        if (currentState == "recording" || currentState == "paused") {
            stopRecordingInternal(stopService = false)
        }
        super.onDestroy()
    }
}
