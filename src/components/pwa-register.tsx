"use client";

import { useEffect } from "react";
import { ensurePushSubscription } from "@/lib/notifications/subscribe-client";
import { playNotificationChime } from "@/lib/notifications/sound";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Listen for chime notifications from Service Worker
    const messageHandler = (event: MessageEvent) => {
      if (event.data && event.data.type === "STUDYSTATION_NOTIFICATION_CHIME") {
        playNotificationChime();
      }
    };
    navigator.serviceWorker.addEventListener("message", messageHandler);

    // Register service worker in production and dev
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // If permission is already granted, ensure push subscription is registered on the server
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          await reg.update().catch(() => {});
          void ensurePushSubscription(false);
        }
      } catch (err) {
        console.warn("[PWA] Service worker registration failed:", err);
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("message", messageHandler);
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
