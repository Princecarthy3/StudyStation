/**
 * Client for the optional StudyStation Native Windows Companion Service.
 *
 * When installed on Windows, the companion runs a lightweight local service on 127.0.0.1:48231
 * that uses Windows Core Audio / WASAPI to record uninterrupted even when Windows locks,
 * modern standby activates, or the browser is suspended.
 */

const COMPANION_PORT = 48231;
const COMPANION_BASE = `http://127.0.0.1:${COMPANION_PORT}`;

export interface CompanionStatus {
  isAvailable: boolean;
  isRecording: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  diskSpaceAvailableBytes?: number;
  version?: string;
}

export class WindowsCompanionClient {
  private static cachedAvailability: boolean | null = null;
  private static lastCheckTime = 0;

  /**
   * Fast non-blocking check if the companion is actively running on localhost.
   */
  public static async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    // Cache check for 10 seconds to avoid unnecessary localhost fetches
    const now = Date.now();
    if (this.cachedAvailability !== null && now - this.lastCheckTime < 10_000) {
      return this.cachedAvailability;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${COMPANION_BASE}/api/health`, {
        method: "GET",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json() as { service?: string };
        const available = data.service === "StudyStation.Windows.Companion";
        this.cachedAvailability = available;
        this.lastCheckTime = now;
        return available;
      }
    } catch {
      // Companion is not running
    }

    this.cachedAvailability = false;
    this.lastCheckTime = now;
    return false;
  }

  public static async getStatus(): Promise<CompanionStatus> {
    const available = await this.isAvailable();
    if (!available) {
      return { isAvailable: false, isRecording: false, isPaused: false, elapsedSeconds: 0 };
    }

    try {
      const res = await fetch(`${COMPANION_BASE}/api/status`, { method: "GET" });
      if (res.ok) {
        const data = await res.json() as {
          isRecording: boolean;
          isPaused: boolean;
          elapsedSeconds: number;
          diskSpaceAvailableBytes?: number;
          version?: string;
        };
        return { isAvailable: true, ...data };
      }
    } catch {
      this.cachedAvailability = false;
    }

    return { isAvailable: false, isRecording: false, isPaused: false, elapsedSeconds: 0 };
  }

  public static async startRecording(title: string): Promise<boolean> {
    try {
      const res = await fetch(`${COMPANION_BASE}/api/record/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startedAt: new Date().toISOString() }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async pauseRecording(): Promise<boolean> {
    try {
      const res = await fetch(`${COMPANION_BASE}/api/record/pause`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async resumeRecording(): Promise<boolean> {
    try {
      const res = await fetch(`${COMPANION_BASE}/api/record/resume`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async stopRecording(): Promise<Blob | null> {
    try {
      const res = await fetch(`${COMPANION_BASE}/api/record/stop`, { method: "POST" });
      if (res.ok) {
        const blob = await res.blob();
        return blob.size > 0 ? blob : null;
      }
    } catch (e) {
      console.warn("[CompanionClient] Stop recording error:", e);
    }
    return null;
  }
}
