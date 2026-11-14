"use client";

import { useEffect, useState } from "react";
import { Monitor, Check, ExternalLink, HardDrive, LayoutGrid, Power } from "lucide-react";
import { WindowsCompanionClient } from "@/lib/windows-companion-client";

interface RunOnOsLoginAPI {
  getState: () => Promise<string>;
  set: (options: { mode: string }) => Promise<void>;
}

export function WindowsIntegrationSettings() {
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [startupSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    const nav = navigator as unknown as { runOnOsLogin?: RunOnOsLoginAPI };
    return Boolean(nav.runOnOsLogin && typeof nav.runOnOsLogin.getState === "function");
  });
  const [startupBusy, setStartupBusy] = useState(false);
  const [companionAvailable, setCompanionAvailable] = useState(false);
  const [companionChecking, setCompanionChecking] = useState(true);
  const [isWindowsOS] = useState(() => typeof window !== "undefined" && /Win/i.test(navigator.userAgent || navigator.platform));

  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    // Check if launched as installed PWA / standalone MSIX app
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandaloneApp(isStandalone);

    // Check navigator.runOnOsLogin state
    const nav = navigator as unknown as { runOnOsLogin?: RunOnOsLoginAPI };
    if (nav.runOnOsLogin && typeof nav.runOnOsLogin.getState === "function") {
      nav.runOnOsLogin.getState()
        .then((state) => {
          setStartupEnabled(state === "windowed");
        })
        .catch(() => {});
    }

    // Check Native Companion
    WindowsCompanionClient.isAvailable().then((available) => {
      setCompanionAvailable(available);
      setCompanionChecking(false);
    });
  }, []);

  async function toggleStartup(enable: boolean) {
    const nav = navigator as unknown as { runOnOsLogin?: RunOnOsLoginAPI };
    if (!nav.runOnOsLogin) return;

    setStartupBusy(true);
    try {
      await nav.runOnOsLogin.set({ mode: enable ? "windowed" : "not-run" });
      setStartupEnabled(enable);
    } catch (e) {
      console.warn("Failed to update Windows startup setting:", e);
    } finally {
      setStartupBusy(false);
    }
  }

  // Only render on Windows machines AND when installed as standalone app (or when startup is configurable)
  if (!mounted || !isWindowsOS || !isStandaloneApp) {
    return null;
  }

  return (
    <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]">
          <Monitor className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-[#28233a]">Windows Desktop Integration</h2>
          <p className="mt-1 text-xs text-[#85808d]">
            Configure desktop features, Windows 11 widgets, and background lecture capture.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {/* Windows Startup Option */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#eeeaf4] p-3.5">
          <div className="flex items-center gap-3">
            <Power className="size-4 text-[#7259e8]" />
            <div>
              <p className="text-xs font-bold text-[#4e485b]">Launch at Windows startup</p>
              <p className="text-[11px] text-[#85808d]">
                Automatically open StudyStation when you log into Windows.
              </p>
            </div>
          </div>
          {startupSupported ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={startupEnabled}
                disabled={startupBusy}
                onChange={(e) => void toggleStartup(e.target.checked)}
                className="size-4 accent-[#7259e8]"
              />
              <span className="text-xs font-semibold text-[#625b6d]">
                {startupEnabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          ) : (
            <span className="text-[11px] font-semibold text-[#85808d] bg-[#f5f3f9] px-2.5 py-1 rounded-lg">
              {isWindowsOS ? "Managed via Windows Settings" : "Available in installed app"}
            </span>
          )}
        </div>

        {/* Windows 11 Widgets Board */}
        <div className="rounded-xl border border-[#eeeaf4] p-3.5">
          <div className="flex items-start gap-3">
            <LayoutGrid className="size-4 text-[#7259e8] mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#4e485b]">Windows 11 Desktop Widgets</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Check className="size-3" /> Ready
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#85808d]">
                Includes 4 interactive widgets: <strong>Today’s Schedule</strong>, <strong>Study Reminders</strong>, <strong>Study Progress</strong>, and <strong>Quick Actions</strong>.
              </p>
              <p className="mt-2 text-[10px] text-[#9993a0]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border text-[10px] font-mono">Win + W</kbd> to open the Widgets Board and click <strong>+</strong> to pin StudyStation widgets.
              </p>
            </div>
          </div>
        </div>

        {/* Background Lecture Recording & Companion */}
        <div className="rounded-xl border border-[#eeeaf4] p-3.5">
          <div className="flex items-start gap-3">
            <HardDrive className="size-4 text-[#7259e8] mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#4e485b]">Background Audio Capture Engine</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  companionAvailable
                    ? "text-purple-700 bg-purple-50"
                    : "text-blue-700 bg-blue-50"
                }`}>
                  {companionAvailable ? "Native Service Active" : "Web Audio Resilient Engine"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#85808d]">
                {companionAvailable
                  ? "Connected to the native Windows Audio Service. Continuous recording is guaranteed across lock screen, display-off, and system sleep."
                  : "Using browser Screen Wake Lock, Web Audio keep-alive, and IndexedDB auto-recovery. Audio is preserved across tab closures and accidental power loss."}
              </p>
              {!companionAvailable && !companionChecking && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[#7259e8]">
                    For sleep-safe uninterrupted hardware recording during modern standby, install the packaged MSIX version from Microsoft Store.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
