/**
 * Push Notification Client Registration Helper
 * Subscribes the current device's Service Worker to PushManager
 * and synchronizes the endpoint keys with Supabase.
 */

export async function ensurePushSubscription(requestPermission = false): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }

  try {
    let perm = Notification.permission;
    if (perm !== "granted") {
      if (!requestPermission) return false;
      perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // If already subscribed, ensure server has it
    if (!subscription) {
      let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        const configRes = await fetch("/api/notifications/subscription", { cache: "no-store" });
        if (configRes.ok) {
          const configData = (await configRes.json()) as { publicKey?: string };
          publicKey = configData.publicKey;
        }
      }

      if (!publicKey) {
        console.warn("[Push] VAPID public key not found on server");
        return false;
      }

      const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const normalizedKey = publicKey.replace(/-/g, "+").replace(/_/g, "/") + padding;
      const keyBuffer = Uint8Array.from(atob(normalizedKey), (c) => c.charCodeAt(0));

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });
    }

    if (subscription) {
      await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      return true;
    }
  } catch (err) {
    console.warn("[Push] Subscription check/sync failed:", err);
  }

  return false;
}
