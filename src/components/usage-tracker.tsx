"use client";

import { useEffect, useRef } from "react";

const FEATURE_MAP: Record<string, string> = {
  home: "home",
  dashboard: "home",
  lectures: "studio",
  studio: "studio",
  record: "record",
  capture: "record",
  assistant: "assistant",
  "study-lab": "study_lab",
  studylab: "study_lab",
  lab: "study_lab",
  groups: "groups",
  planner: "planner",
  calendar: "planner",
  courses: "courses",
  profile: "profile",
  progress: "progress",
  reports: "progress",
  notifications: "notifications",
};

function mapFeature(view: string | null | undefined) {
  if (!view) return "home";
  const key = view.toLowerCase().replace(/\s+/g, "");
  return FEATURE_MAP[key] || FEATURE_MAP[view.toLowerCase()] || "other";
}

/**
 * Lightweight session + feature heartbeat for admin engagement metrics.
 * - Starts/continues an app_sessions row
 * - Logs a usage_events row when the active view changes
 * - Pings every 60s while the tab is visible
 */
export function UsageTracker({ view }: { view?: string | null }) {
  const sessionIdRef = useRef<string | null>(null);
  const lastFeatureRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;
    const feature = mapFeature(view);

    async function beat(opts?: { end?: boolean; feature?: string | null }) {
      try {
        const response = await fetch("/api/usage/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            feature: opts?.feature,
            end: opts?.end === true,
          }),
          keepalive: opts?.end === true,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { sessionId?: string };
        if (data.sessionId) sessionIdRef.current = data.sessionId;
      } catch {
        /* ignore offline */
      }
    }

    // New feature view → log event
    const featureToSend = lastFeatureRef.current !== feature ? feature : null;
    if (featureToSend) lastFeatureRef.current = feature;
    void beat({ feature: featureToSend });

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !stopped) {
        void beat();
      }
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void beat({ end: false });
      } else {
        void beat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => {
      void beat({ end: true });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [view]);

  return null;
}
