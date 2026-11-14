import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification, type PushNotification } from "@/lib/notifications/push";

export interface AppNotificationInput {
  userIds: string[];
  type:
    | "timetable_reminder"
    | "assignment_due"
    | "exam_reminder"
    | "study_reminder"
    | "study_group_join"
    | "study_group_invite"
    | "study_group_call"
    | "missed_call"
    | "message"
    | "recording_complete"
    | "announcement";
  title: string;
  body: string;
  actionUrl?: string;
  actions?: Array<{ action: string; title: string }>;
  dedupeKeyPrefix?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export async function dispatchNotification(input: AppNotificationInput) {
  const { userIds, type, title, body, actionUrl = "/app", actions, dedupeKeyPrefix, tag, requireInteraction } = input;
  if (!userIds.length) return;

  const admin = createAdminClient();

  // 1. In-app database notifications (deduplicated per user)
  const notificationRows = userIds.map((userId) => ({
    user_id: userId,
    type,
    title,
    body,
    action_url: actionUrl,
    dedupe_key: dedupeKeyPrefix ? `${dedupeKeyPrefix}:${userId}` : undefined,
  }));

  try {
    const { error: dbError } = await admin
      .from("notifications")
      .upsert(notificationRows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    if (dbError) {
      console.warn("[Notifications] In-app notification write warning:", { code: dbError.code, message: dbError.message });
    }
  } catch (err) {
    console.warn("[Notifications] In-app notification write exception:", err);
  }

  // 2. Windows Push Notification dispatch
  const pushPayload: PushNotification = {
    title,
    body,
    type,
    url: actionUrl,
    actions: actions || [
      { action: "open", title: "Open" },
    ],
    tag: tag || dedupeKeyPrefix || type,
    requireInteraction: Boolean(requireInteraction),
  };

  try {
    await sendPushNotification(userIds, pushPayload);
  } catch (err) {
    console.error("[Notifications] Web push dispatch failed:", err);
  }
}
