/**
 * Bridge to the Android Capacitor LectureRecorder plugin.
 * On web / iOS this reports unsupported; the existing MediaRecorder path is used.
 * No Capacitor npm dependency — talks to window.Capacitor injected by the native shell.
 */

export type NativeRecordingState = "idle" | "recording" | "paused" | "stopping" | "error";

export type NativeRecordingStatus = {
  state: NativeRecordingState;
  durationMs: number;
  recordingId: string | null;
  filePath: string | null;
  errorMessage?: string | null;
};

export type NativeRecordingEvent =
  | { type: "state"; status: NativeRecordingStatus }
  | { type: "duration"; durationMs: number }
  | { type: "error"; message: string };

type LectureRecorderPlugin = {
  startRecording(options: { title?: string; courseId?: string }): Promise<NativeRecordingStatus>;
  pauseRecording(): Promise<NativeRecordingStatus>;
  resumeRecording(): Promise<NativeRecordingStatus>;
  stopRecording(): Promise<NativeRecordingStatus & { fileUri?: string; mimeType?: string; byteSize?: number }>;
  getRecordingStatus(): Promise<NativeRecordingStatus>;
  addListener?(
    eventName: "recordingStateChange" | "recordingDuration" | "recordingError",
    listener: (payload: Record<string, unknown>) => void,
  ): Promise<{ remove: () => void }> | { remove: () => void };
};

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
};

function getCapacitor(): CapacitorBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null;
}

export function isNativeAndroidRecorderAvailable(): boolean {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return false;
  const plugins = cap.Plugins ?? {};
  return Boolean(plugins.LectureRecorder) || Boolean((window as unknown as { LectureRecorder?: unknown }).LectureRecorder);
}

function getPlugin(): LectureRecorderPlugin | null {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;
  const plugin = (cap.Plugins?.LectureRecorder ??
    (window as unknown as { LectureRecorder?: LectureRecorderPlugin }).LectureRecorder) as
    | LectureRecorderPlugin
    | undefined;
  return plugin ?? null;
}

export async function nativeStartRecording(options: { title?: string; courseId?: string } = {}) {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.startRecording(options);
}

export async function nativePauseRecording() {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.pauseRecording();
}

export async function nativeResumeRecording() {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.resumeRecording();
}

export async function nativeStopRecording() {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.stopRecording();
}

export async function nativeGetRecordingStatus() {
  const plugin = getPlugin();
  if (!plugin) return { state: "idle" as const, durationMs: 0, recordingId: null, filePath: null };
  return plugin.getRecordingStatus();
}

export async function subscribeNativeRecording(
  onEvent: (event: NativeRecordingEvent) => void,
): Promise<() => void> {
  const plugin = getPlugin();
  if (!plugin?.addListener) return () => undefined;

  const handles: Array<{ remove: () => void }> = [];
  const events: Array<["recordingStateChange" | "recordingDuration" | "recordingError", (p: Record<string, unknown>) => void]> = [
    [
      "recordingStateChange",
      (payload) => onEvent({ type: "state", status: payload as unknown as NativeRecordingStatus }),
    ],
    [
      "recordingDuration",
      (payload) => onEvent({ type: "duration", durationMs: Number((payload as { durationMs?: number }).durationMs ?? 0) }),
    ],
    [
      "recordingError",
      (payload) => onEvent({ type: "error", message: String((payload as { message?: string }).message ?? "Recording error") }),
    ],
  ];

  for (const [name, listener] of events) {
    const handle = await Promise.resolve(plugin.addListener(name, listener));
    handles.push(handle);
  }

  return () => {
    handles.forEach((h) => {
      try {
        h.remove();
      } catch {
        /* ignore */
      }
    });
  };
}
