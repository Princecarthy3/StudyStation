# StudyStation Android native recording

Kotlin **foreground-service** recorder and Capacitor **LectureRecorder** plugin sources.

## Architecture

- Capacitor WebView loads `https://studystation.vercel.app` (`capacitor.config.ts`).
- `LectureRecordingService` — mic foreground service + notification (Pause / Resume / Stop).
- `LectureRecorderPlugin` — JS bridge: start, pause, resume, stop, status, events.
- Web: `src/lib/native/lecture-recorder.ts` + capture UI in `app-shell.tsx` (native when available, else MediaRecorder).

## Build (Android Studio + SDK required)

```bash
npm install
npx cap add android
# Copy this package’s Java/Kotlin sources into android/app/src/main/java/...
# Merge permissions + service into AndroidManifest.xml
npx cap sync android
npx cap open android
```

## Security

No Supabase service-role key in the APK. Uploads use the same signed URLs as the website.
