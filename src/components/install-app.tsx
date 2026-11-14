"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, Download, MoreVertical, Share2, Smartphone, X } from "lucide-react";
import { ANDROID_APK_URL } from "@/lib/android-download";
import { AndroidIcon } from "@/components/android-icon";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type DevicePlatform = "ios" | "android" | "desktop";

type InstallContextValue = {
  openInstallInstructions: () => void;
  platform: DevicePlatform;
  isInstalled: boolean;
};

const InstallContext = createContext<InstallContextValue | null>(null);

const INSTALL_SEEN_KEY = "ss_install_prompt_seen_v1";

export function detectDevicePlatform(): DevicePlatform {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as MacIntel with touch
  const iPadOs = navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOs) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<DevicePlatform>("desktop");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    setPlatform(detectDevicePlatform());
    setIsInstalled(isStandaloneApp());
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showInstructions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowInstructions(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInstructions]);

  const openInstallInstructions = useCallback(() => {
    setInstallError("");
    setShowInstructions(true);
    try {
      window.localStorage.setItem(INSTALL_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  async function installNow() {
    if (!installPrompt) return;
    setIsInstalling(true);
    setInstallError("");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setShowInstructions(false);
        setIsInstalled(true);
      }
    } catch {
      setInstallError("The install prompt could not open. Follow the steps below instead.");
    } finally {
      setIsInstalling(false);
    }
  }

  const platformLabel =
    platform === "ios" ? "iPhone & iPad" : platform === "android" ? "Android" : "This device";

  return (
    <InstallContext.Provider value={{ openInstallInstructions, platform, isInstalled }}>
      {children}
      {showInstructions && (
        <div
          className="install-overlay fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#17132d]/60 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowInstructions(false);
          }}
        >
          <section className="install-card my-auto w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(14,10,34,.32)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#211a43] via-[#392b78] to-[#7259e8] px-6 py-7 text-white sm:px-8">
              <div className="absolute -right-12 -top-20 size-56 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                    {platform === "android" ? <AndroidIcon className="size-6" /> : <Smartphone className="size-6" />}
                  </span>
                  <p className="mt-5 text-[10px] font-black uppercase tracking-[.18em] text-white/65">
                    Install for {platformLabel}
                  </p>
                  <h2 id="install-title" className="mt-1 text-2xl font-black tracking-tight sm:text-[28px]">
                    {platform === "ios"
                      ? "Add StudyStation to your Home Screen"
                      : platform === "android"
                        ? "Install StudyStation on Android"
                        : "Install StudyStation"}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/75">
                    {platform === "ios"
                      ? "On iPhone and iPad, install from Safari so lectures, notes, and study tools open like an app."
                      : platform === "android"
                        ? "Install the Android app or add StudyStation to your home screen for faster access."
                        : "Add StudyStation to this device for quicker access to your study space."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructions(false)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close install instructions"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-7">
              {platform === "ios" && (
                <article className="install-instructions rounded-2xl border border-[#e8e4f1] bg-[#faf9fd] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                      <Share2 className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#211b35]">iPhone & iPad · Safari</h3>
                      <p className="text-[10px] font-semibold text-[#878193]">Add to Home Screen</p>
                    </div>
                  </div>
                  <ol className="mt-4 space-y-3 text-xs leading-5 text-[#5f596b]">
                    <li className="flex gap-2.5">
                      <span className="step-number">1</span>
                      <span>Open StudyStation in <b>Safari</b> (not Chrome or an in-app browser).</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="step-number">2</span>
                      <span>
                        Tap <Share2 className="mx-0.5 inline size-3.5 text-[#7259e8]" /> <b>Share</b> at the bottom of Safari.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="step-number">3</span>
                      <span>Scroll and choose <b>Add to Home Screen</b>.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="step-number">4</span>
                      <span>Tap <b>Add</b>. Open StudyStation from your home screen like any other app.</span>
                    </li>
                  </ol>
                </article>
              )}

              {platform === "android" && (
                <>
                  <article className="install-instructions rounded-2xl border border-[#e8e4f1] bg-[#faf9fd] p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-9 place-items-center rounded-xl bg-[#e8f7ef] text-[#20815b]">
                        <MoreVertical className="size-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-[#211b35]">Android · Chrome</h3>
                        <p className="text-[10px] font-semibold text-[#878193]">Install or Add to Home screen</p>
                      </div>
                    </div>
                    <ol className="mt-4 space-y-3 text-xs leading-5 text-[#5f596b]">
                      <li className="flex gap-2.5">
                        <span className="step-number">1</span>
                        <span>Open StudyStation in <b>Chrome</b> or Samsung Internet.</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="step-number">2</span>
                        <span>
                          Tap the menu <MoreVertical className="mx-0.5 inline size-3.5 text-[#20815b]" />.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="step-number">3</span>
                        <span>Choose <b>Install app</b> or <b>Add to Home screen</b>.</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="step-number">4</span>
                        <span>Confirm <b>Install</b>. Or download the APK below.</span>
                      </li>
                    </ol>
                  </article>
                  <div className="rounded-2xl border border-[#e4dcff] bg-[#f7f4ff] p-4">
                    <p className="text-xs font-bold text-[#5b47bd]">Prefer a direct install?</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#6f6785]">
                      Download the Android package (sideload). Allow installs from this source if Android asks.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={ANDROID_APK_URL}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-4 text-[12px] font-extrabold text-white"
                      >
                        <AndroidIcon className="size-3.5" /> Download for Android
                      </a>
                      <a
                        href="/download"
                        className="inline-flex h-10 items-center rounded-xl border border-[#e4dcff] bg-white px-4 text-[12px] font-extrabold text-[#5b47bd]"
                      >
                        Install guide
                      </a>
                    </div>
                  </div>
                </>
              )}

              {platform === "desktop" && (
                <article className="install-instructions rounded-2xl border border-[#e8e4f1] bg-[#faf9fd] p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#eeeaff] text-[#7259e8]">
                      <Download className="size-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#211b35]">Computer browser</h3>
                      <p className="text-[10px] font-semibold text-[#878193]">Chrome · Edge · desktop install</p>
                    </div>
                  </div>
                  <ol className="mt-4 space-y-3 text-xs leading-5 text-[#5f596b]">
                    <li className="flex gap-2.5">
                      <span className="step-number">1</span>
                      <span>Look for the install icon in the address bar, or open the browser menu.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="step-number">2</span>
                      <span>Choose <b>Install StudyStation</b> / <b>Install app</b>.</span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="step-number">3</span>
                      <span>
                        On a phone instead? Open this site on your <b>iPhone</b> or <b>Android</b> and tap Install app
                        there for device-specific steps.
                      </span>
                    </li>
                  </ol>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="/download"
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e4dcff] bg-white px-4 text-[12px] font-extrabold text-[#5b47bd]"
                    >
                      <AndroidIcon className="size-3.5" /> Android download page
                    </a>
                  </div>
                </article>
              )}

              {installPrompt && !isInstalled && platform !== "ios" && (
                <button
                  type="button"
                  disabled={isInstalling}
                  onClick={() => void installNow()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-sm font-extrabold text-white shadow-md shadow-[#7259e8]/20 transition hover:bg-[#6048d5] disabled:opacity-60"
                >
                  {isInstalling ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Install now
                </button>
              )}

              {installError && (
                <p role="alert" className="text-xs text-[#a44e48]">
                  {installError}
                </p>
              )}
              {isInstalled && (
                <p className="flex items-center gap-2 text-xs font-bold text-[#20815b]">
                  <Check className="size-4" /> StudyStation is already installed on this device.
                </p>
              )}
            </div>

            <div className="flex justify-end border-t border-[#f0ecf6] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded-xl border border-[#e6e2ed] px-4 py-2.5 text-xs font-extrabold text-[#625b70] transition hover:bg-[#f8f6fb]"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </InstallContext.Provider>
  );
}

export function useInstallApp() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstallApp must be used within InstallAppProvider.");
  return context;
}

/** Call once after login on mobile to gently offer install (first visits only). */
export function usePromptInstallAfterLogin(enabled: boolean) {
  const { openInstallInstructions, platform, isInstalled } = useInstallApp();

  useEffect(() => {
    if (!enabled || isInstalled) return;
    if (platform !== "ios" && platform !== "android") return;
    try {
      if (window.localStorage.getItem(INSTALL_SEEN_KEY) === "1") return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      openInstallInstructions();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [enabled, isInstalled, openInstallInstructions, platform]);
}
