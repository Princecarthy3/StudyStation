import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushNotification = {
  title: string;
  body: string;
  type: string;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
  tag?: string;
  requireInteraction?: boolean;
};

const categoryByType: Record<string, string> = {
  assignment_due: "assignments",
  exam_reminder: "assignments",
  timetable_reminder: "classes",
  study_reminder: "study",
  study_group_join: "groups",
  study_group_invite: "groups",
  study_group_call: "calls",
  missed_call: "calls",
  message: "messages",
  recording_complete: "recordings",
  announcement: "system",
};

const FALLBACK_VAPID_PUBLIC_KEY = "BKFVE4zKCCPGaYUiClW8xjE4On_7iqIEWDikhJk66V-dnXrZvm9xyf9bv2_cZ76w4mr3etHQ1lWxeErCnIHTl0I";
const FALLBACK_VAPID_PRIVATE_KEY = "7likcaT9m2g88coFQ3rbQ2v8e42Xz95cCcE_TpuS4T4";
const FALLBACK_VAPID_SUBJECT = "mailto:notifications@studystation.vercel.app";

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || FALLBACK_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || FALLBACK_VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT?.trim() || FALLBACK_VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("Web Push is not configured; database notifications will still be delivered in-app.");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPushNotification(userIds: string[], notification: PushNotification) {
  if (!userIds.length || !configureVapid()) return;

  const admin = createAdminClient();
  const { data: preferences, error: preferenceError } = await admin
    .from("notification_preferences")
    .select("user_id, enabled, categories")
    .in("user_id", userIds);
  if (preferenceError) {
    console.error("Web Push preferences could not be loaded", { code: preferenceError.code });
    return;
  }

  const preferenceByUser = new Map((preferences ?? []).map((preference) => [preference.user_id, preference]));
  const category = categoryByType[notification.type] ?? "system";
  const eligibleUserIds = userIds.filter((userId) => {
    const preference = preferenceByUser.get(userId);
    return preference?.enabled !== false && preference?.categories?.[category] !== false;
  });
  if (!eligibleUserIds.length) return;

  const { data: subscriptions, error: subscriptionError } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", eligibleUserIds);
  if (subscriptionError) {
    console.error("Web Push subscriptions could not be loaded", { code: subscriptionError.code });
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    tag: notification.tag || notification.type,
    requireInteraction: notification.requireInteraction ?? false,
    actions: notification.actions ?? [{ action: "open", title: "Open" }],
    data: {
      url: notification.url || "/app",
      open: notification.url || "/app",
    },
  });

  await Promise.all((subscriptions ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload);
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        if (deleteError) console.error("Expired Web Push subscription could not be removed", { code: deleteError.code });
        return;
      }
      console.error("Web Push delivery failed", {
        subscriptionId: subscription.id,
        statusCode: statusCode || "unknown",
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }));
}
