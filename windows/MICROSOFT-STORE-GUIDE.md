# StudyStation — Windows App Integration & Microsoft Store Submission Guide

This guide details the complete Windows desktop integration architecture, manifest configuration, capability audit, and Microsoft Store certification instructions for **StudyStation**.

---

## 1. Executive Summary & Architecture Overview

StudyStation is designed as a hybrid Windows application:
1. **Modern Hosted Web App (PWA) Layer**: Runs in Microsoft Edge / WebView2 with high security isolation, fast updates directly from Vercel deployments, Screen Wake Lock, Web Audio keep-alive, and IndexedDB crash recovery.
2. **Windows 11 Desktop Widgets Board**: Four interactive desktop widgets powered by Adaptive Cards (`schedule.json`, `reminders.json`, `progress.json`, `quick-actions.json`) and service worker lifecycle integration.
3. **Windows Push Notifications (WNS / Web Push)**: Deep integration with Windows Notification Center, providing native toast alerts with action buttons ("Join Call", "View Notes", "Start Recording", "Dismiss").
4. **Native Windows Audio Companion (`StudyStation.Windows.Companion`)**: A lightweight background service using Windows Core Audio / WASAPI and Windows Kernel Execution State (`SetThreadExecutionState`) to guarantee uninterrupted lecture capture when a laptop locks or enters modern standby.

---

## 2. Capability Audit & Microsoft Store Certification Resolution

### The Issue
Previous PWABuilder packaging templates automatically injected:
```xml
<rescap:Capability Name="runFullTrust" />
```
under the `http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities` namespace.

When submitted to Microsoft Partner Center, this immediately triggered the certification blocker:
> *"The package requests the restricted capability 'runFullTrust'. You must declare a valid technical justification for using restricted capabilities, or remove them."*

### The Resolution
In `windows/Package.appxmanifest`:
1. **Removed `runFullTrust`**: For the standard Hosted Web App store package, `runFullTrust` is completely unnecessary. Removing it immediately removes the restricted capability barrier and allows clean, automated Store certification under Microsoft Store Policy 10.2.
2. **Standard Non-Restricted Capabilities Retained**:
   - `<Capability Name="internetClient" />`
     - **Purpose**: Allows the application to access the internet. Required for Supabase authentication, database queries, and WebRTC study call signaling.
     - **Store Impact**: Standard capability. No justification required.
   - `<DeviceCapability Name="microphone" />`
     - **Purpose**: Allows access to the microphone. Required for lecture audio recording and study group voice calls.
     - **Store Impact**: Standard device capability. Windows prompts the user for consent on first use. No restricted capability warning.
   - `<DeviceCapability Name="webcam" />`
     - **Purpose**: Allows access to the camera. Required for video study calls.
     - **Store Impact**: Standard device capability. No restricted capability warning.

---

## 3. Windows 11 Desktop Widgets Board Integration

StudyStation implements official PWA Widgets for the Windows 11 Widgets Board.

### Declared Widgets
| Widget Name | Tag | Template | Data API | Update Interval |
| :--- | :--- | :--- | :--- | :--- |
| **Today's Schedule** | `studystation-schedule` | `/widgets/schedule.json` | `/api/widgets/data?type=schedule` | 15 min (900s) |
| **Study Reminders** | `studystation-reminders` | `/widgets/reminders.json` | `/api/widgets/data?type=reminders` | 30 min (1800s) |
| **Study Progress** | `studystation-progress` | `/widgets/progress.json` | `/api/widgets/data?type=progress` | 60 min (3600s) |
| **Quick Actions** | `studystation-quick-actions` | `/widgets/quick-actions.json` | `/api/widgets/data?type=actions` | 24 hours (86400s) |

### How to Test Widgets on Windows 11
1. Install StudyStation via Microsoft Edge or side-loaded MSIX.
2. Press <kbd>Win</kbd> + <kbd>W</kbd> to open the Windows 11 Widgets Board.
3. Click the **+** (Add Widgets) button.
4. Select **StudyStation** from the list of available widget providers.
5. Pin **Today's Schedule**, **Study Reminders**, or **Quick Actions** to your board.

---

## 4. Background Recording Resilience & Crash Recovery

### Browser Layer
- **IndexedDB Segment Journaling (`RecordingJournal`)**: In `src/lib/recording-recovery.ts`, audio chunks are automatically persisted every second into the client-side IndexedDB store.
- **Crash Recovery**: If the student's browser closes unexpectedly, battery dies, or PC crashes, reopening StudyStation automatically detects the unfinalized recording, displaying a prominent recovery banner:
  > *"Interrupted Recording Recovered (X min) — StudyStation preserved your unsaved recording: [Lecture Title]. [Recover & Upload] [Discard]"*
- **Screen Wake Lock & Keep-Alive**: Uses `navigator.wakeLock.request('screen')` combined with silent audio keep-alive loop and MediaSession lock-screen widget.

### Native Windows Audio Companion
- Located in `windows/StudyStation.Windows.Companion/`.
- Uses `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_AWAYMODE_REQUIRED)` to keep audio capture active even when the PC locks or screen shuts off.
- Serves local authenticated endpoints on `127.0.0.1:48231`.
- Automatically detected by StudyStation (`WindowsCompanionClient.isAvailable()`).

---

## 5. Local Build & Test Instructions

### Step 1: Run Manifest & Packaging Validation
Open PowerShell in the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File windows/build-windows-package.ps1
```

### Step 2: (Optional) Side-Load Package for Developer Testing
To test the MSIX on a local Windows 10/11 machine without the Microsoft Store:
1. Generate a developer self-signed certificate:
   ```powershell
   New-SelfSignedCertificate -Type Custom -Subject "CN=StudyStation" -KeyUsage DigitalSignature -FriendlyName "StudyStation Developer" -CertStoreLocation "Cert:\CurrentUser\My"
   ```
2. Export the certificate to a `.pfx` file and sign the MSIX:
   ```powershell
   powershell -ExecutionPolicy Bypass -File windows/build-windows-package.ps1 -SignPackage -CertificatePath "path\to\StudyStation.pfx"
   ```
3. Double-click the generated `.msix` in `windows/dist/` to install.

---

## 6. Microsoft Partner Center Submission Checklist

When submitting the updated package to Microsoft Partner Center:

1. **Package Upload**:
   - Upload the `.msix` generated by `build-windows-package.ps1` (or package via PWABuilder online by pointing to `https://studystation.vercel.app/manifest.webmanifest`).
2. **Store Listing**:
   - **Title**: StudyStation — AI Study Companion
   - **Description**: Capture lectures, generate AI study notes, revise flashcards, practice exam quizzes, and manage timetables and study groups.
   - **Keywords**: StudyStation, lecture notes, transcription, study planner, study groups, college assistant.
   - **Category**: Education > Study aids
3. **Certification Notes (Paste this into Partner Center)**:
   > *"StudyStation is an AI-powered study companion for university students. The application requests standard capabilities: internetClient (for syncing student notes and timetable data), microphone (for lecture audio recording and study voice calls), and webcam (for study group video calls). All restricted capabilities (such as runFullTrust) have been removed, adhering strictly to Microsoft Store Certification Policy 10.2."*
4. **Privacy Policy**:
   - `https://studystation.vercel.app/privacy`
5. **Support URL**:
   - `https://studystation.vercel.app/about`
