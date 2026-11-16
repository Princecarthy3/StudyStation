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

/**
 * Write in-app notification + send Web Push (same path used by group calls).
 * When dedupeKeyPrefix is set, push is only sent the first time that key is stored
 * so a 5-minute cron does not spam the same reminder.
 */
export async function dispatchNotification(input: AppNotificationInput) {
  const { userIds, type, title, body, actionUrl = "/app", actions, dedupeKeyPrefix, tag, requireInteraction } = input;
  if (!userIds.length) return;

  const admin = createAdminClient();
  const pushRecipients: string[] = [];

  for (const userId of userIds) {
    const dedupe_key = dedupeKeyPrefix ? `${dedupeKeyPrefix}:${userId}` : null;
    const row: Record<string, unknown> = {
      user_id: userId,
      type,
      title,
      body,
      action_url: actionUrl,
    };
    if (dedupe_key) row.dedupe_key = dedupe_key;

    if (dedupe_key) {
      // Prefer insert so we know if this is the first delivery.
      const { error } = await admin.from("notifications").insert(row);
      if (error) {
        const code = String((error as { code?: string }).code || "");
        const msg = String(error.message || "").toLowerCase();
        // Unique violation → already notified for this window; skip push.
        if (code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
          continue;
        }
        // Fallback upsert for schema quirks, still attempt push once.
        const { error: upErr } = await admin
          .from("notifications")
          .upsert(row, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
        if (upErr) {
          console.warn("[Notifications] In-app write failed:", upErr.message);
        }
        // If upsert ignored duplicate we cannot tell — still try push only via insert path above.
        continue;
      }
      pushRecipients.push(userId);
    } else {
      const { error } = await admin.from("notifications").insert(row);
      if (error) {
        console.warn("[Notifications] In-app write failed:", error.message);
      }
      // No dedupe key (calls/announcements style): always push.
      pushRecipients.push(userId);
    }
  }

  if (!pushRecipients.length) return;

  const pushPayload: PushNotification = {
    title,
    body,
    type,
    url: actionUrl,
    actions: actions || [{ action: "open", title: "Open" }],
    tag: tag || dedupeKeyPrefix || type,
    requireInteraction: Boolean(requireInteraction),
  };

  try {
    await sendPushNotification(pushRecipients, pushPayload);
  } catch (err) {
    console.error("[Notifications] Web push dispatch failed:", err);
  }
}
