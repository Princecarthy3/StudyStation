"use client";

import { useEffect, useState } from "react";
import { Bell, Check, LoaderCircle } from "lucide-react";

const categoryLabels = [
  ["classes", "Classes and timetable"],
  ["assignments", "Assignments and exams"],
  ["study", "Study reminders"],
  ["groups", "Study groups"],
  ["messages", "Messages and activity"],
  ["calls", "Incoming and missed calls"],
  ["recordings", "Recording completion"],
  ["system", "Important StudyStation updates"],
] as const;

type Preferences = {
  enabled: boolean;
  categories: Record<string, boolean>;
};

function isPushSupported() {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/notifications/preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Notification preferences could not be loaded.");
        return response.json() as Promise<Preferences>;
      })
      .then((value) => {
        if (active) setPreferences(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Notification preferences could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  async function save(next: Preferences, requestPermission = false) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (requestPermission) {
        if (!isPushSupported()) throw new Error("Push notifications are not supported in this browser.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Browser notification permission was not granted.");
        const registration = await navigator.serviceWorker.ready;
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) throw new Error("Push notifications are not configured for this deployment.");
        const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const normalizedKey = publicKey.replace(/-/g, "+").replace(/_/g, "/") + padding;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(atob(normalizedKey), (char) => char.charCodeAt(0)),
        });
        const response = await fetch("/api/notifications/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...subscription.toJSON(), userAgent: navigator.userAgent }),
        });
        if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Push subscription could not be saved.");
      } else if (!next.enabled && isPushSupported()) {
        const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (subscription) {
          const response = await fetch("/api/notifications/subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Push subscription could not be removed.");
          await subscription.unsubscribe();
        }
      }

      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Notification preferences could not be saved.");
      setPreferences(await response.json() as Preferences);
      setMessage("Notification preferences saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notification preferences could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!preferences) {
    return <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7"><LoaderCircle className="size-4 animate-spin text-[#7259e8]" /></section>;
  }

  const toggleCategory = (key: string) => {
    const next = { ...preferences, categories: { ...preferences.categories, [key]: !preferences.categories[key] } };
    setPreferences(next);
    void save(next);
  };

  return <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]"><Bell className="size-4" /></span>
      <div><h2 className="text-sm font-extrabold text-[#28233a]">Notifications</h2><p className="mt-1 text-xs text-[#85808d]">Choose which StudyStation alerts can reach this device.</p></div>
    </div>
    {!isPushSupported() && <p className="mt-4 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs text-[#8b682d]">Push notifications are not supported in this browser. In-app notifications remain available.</p>}
    {isPushSupported() && Notification.permission !== "granted" && <button type="button" disabled={busy} onClick={() => void save(preferences, true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#7259e8] px-3 text-xs font-extrabold text-white disabled:opacity-60"><Check className="size-3.5" />Enable notifications on this device</button>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1ef] px-3 py-2 text-xs text-[#a44e48]">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-[#f1efff] px-3 py-2 text-xs text-[#5b47bd]">{message}</p>}
    <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-[#eeeaf4] px-3 py-3 text-xs font-bold text-[#4e485b]">
      <span>Allow StudyStation notifications</span>
      <input type="checkbox" checked={preferences.enabled} disabled={busy} onChange={(event) => {
        const next = { ...preferences, enabled: event.target.checked };
        setPreferences(next);
        void save(next, event.target.checked);
      }} className="size-4 accent-[#7259e8]" />
    </label>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {categoryLabels.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-[#eeeaf4] px-3 py-2.5 text-xs font-semibold text-[#625b6d]"><input type="checkbox" checked={preferences.enabled && preferences.categories[key] !== false} disabled={busy || !preferences.enabled} onChange={() => toggleCategory(key)} className="size-4 accent-[#7259e8]" />{label}</label>)}
    </div>
    {busy && <p className="mt-3 inline-flex items-center gap-2 text-[11px] text-[#85808d]"><LoaderCircle className="size-3 animate-spin" />Saving…</p>}
  </section>;
}
