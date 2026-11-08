/**
 * Bridge to the Android Capacitor LectureRecorder plugin.
 * On web / iOS this module reports unsupported and the existing MediaRecorder path is used.
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
  addListener(
    eventName: "recordingStateChange" | "recordingDuration" | "recordingError",
    listener: (payload: Record<string, unknown>) => void,
  ): Promise<{ remove: () => void }>;
};

function getCapacitor(): { isNativePlatform: () => boolean; Plugins?: Record<string, unknown> } | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> } }).Capacitor;
  return cap ?? null;
}

export function isNativeAndroidRecorderAvailable(): boolean {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return false;
  // Plugin is registered on Android shell only
  const plugins = cap.Plugins ?? {};
  return Boolean(plugins.LectureRecorder) || Boolean((window as unknown as { LectureRecorder?: unknown }).LectureRecorder);
}

async function getPlugin(): Promise<LectureRecorderPlugin | null> {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return null;

  try {
    // Prefer registerPlugin when @capacitor/core is available
    const core = await import("@capacitor/core");
    const plugin = core.registerPlugin<LectureRecorderPlugin>("LectureRecorder");
    return plugin;
  } catch {
    const fallback = (cap.Plugins?.LectureRecorder ?? (window as unknown as { LectureRecorder?: LectureRecorderPlugin }).LectureRecorder) as
      | LectureRecorderPlugin
      | undefined;
    return fallback ?? null;
  }
}

export async function nativeStartRecording(options: { title?: string; courseId?: string } = {}) {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.startRecording(options);
}

export async function nativePauseRecording() {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.pauseRecording();
}

export async function nativeResumeRecording() {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.resumeRecording();
}

export async function nativeStopRecording() {
  const plugin = await getPlugin();
  if (!plugin) throw new Error("Native Android recorder is not available.");
  return plugin.stopRecording();
}

export async function nativeGetRecordingStatus() {
  const plugin = await getPlugin();
  if (!plugin) return { state: "idle" as const, durationMs: 0, recordingId: null, filePath: null };
  return plugin.getRecordingStatus();
}

export async function subscribeNativeRecording(
  onEvent: (event: NativeRecordingEvent) => void,
): Promise<() => void> {
  const plugin = await getPlugin();
  if (!plugin?.addListener) return () => undefined;

  const handles: Array<{ remove: () => void }> = [];
  handles.push(
    await plugin.addListener("recordingStateChange", (payload) => {
      onEvent({ type: "state", status: payload as unknown as NativeRecordingStatus });
    }),
  );
  handles.push(
    await plugin.addListener("recordingDuration", (payload) => {
      onEvent({ type: "duration", durationMs: Number((payload as { durationMs?: number }).durationMs ?? 0) });
    }),
  );
  handles.push(
    await plugin.addListener("recordingError", (payload) => {
      onEvent({ type: "error", message: String((payload as { message?: string }).message ?? "Recording error") });
    }),
  );

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
