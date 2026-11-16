import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/notifications/push";

function minutesUntil(target: Date, now: Date) {
  return Math.round((target.getTime() - now.getTime()) / (60 * 1000));
}

function hoursUntil(target: Date, now: Date) {
  return Math.round((target.getTime() - now.getTime()) / (60 * 60 * 1000));
}

function isExamLike(title: string, type?: string | null) {
  if (type === "exam") return true;
  return /exam|quiz|midterm|final|test\b/i.test(title);
}

function isAssignmentLike(title: string, type?: string | null) {
  if (type === "assignment") return true;
  return /assignment|homework|project|deadline|due\b/i.test(title);
}

/**
 * Deliver one reminder the same way group calls do:
 * insert in-app row, then Web Push via sendPushNotification.
 */
async function deliverReminder(input: {
  userId: string;
  type:
    | "timetable_reminder"
    | "assignment_due"
    | "exam_reminder"
    | "study_reminder";
  title: string;
  body: string;
  actionUrl: string;
  dedupeKey: string;
  tag: string;
  requireInteraction?: boolean;
  actionTitle?: string;
}) {
  const admin = createAdminClient();

  // Skip if this exact window was already stored (avoids push spam).
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", input.userId)
    .eq("dedupe_key", input.dedupeKey)
    .maybeSingle();
  if (existing?.id) return false;

  const { error: insertError } = await admin.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    action_url: input.actionUrl,
    dedupe_key: input.dedupeKey,
  });

  // Unique race: another worker inserted first — do not push again.
  if (insertError) {
    const code = String((insertError as { code?: string }).code || "");
    const msg = String(insertError.message || "").toLowerCase();
    if (code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
      return false;
    }
    // Still attempt push if the in-app write failed for a non-dedupe reason
    // (matches resilience of call notifications).
    console.warn("[Reminders] in-app insert warning:", insertError.message);
  }

  // Same Web Push entry point used by group calls / announcements.
  await sendPushNotification([input.userId], {
    type: input.type,
    title: input.title,
    body: input.body,
    url: input.actionUrl,
    actions: [
      { action: "open", title: input.actionTitle || "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    tag: input.tag,
    requireInteraction: Boolean(input.requireInteraction),
  });
  return true;
}

/**
 * Process class, study-block, and task-due reminders for one user.
 * Uses the same Web Push pipeline as group calls so alerts can show
 * when the app is closed and the screen is off.
 */
export async function processUserReminders(
  userId: string,
  admin: any,
  now = new Date(),
) {
  let remindersSent = 0;
  const checked = { events: 0, tasks: 0, studyBlocks: 0 };

  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const { data: upcomingEvents } = await admin
    .from("timetable_events")
    .select("id, title, location, type, starts_at, ends_at")
    .eq("user_id", userId)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", in2Hours.toISOString());

  if (upcomingEvents?.length) {
    checked.events = upcomingEvents.length;
    for (const event of upcomingEvents) {
      const startTime = new Date(event.starts_at);
      const mins = Math.max(0, minutesUntil(startTime, now));
      let windowTag: string | null = null;
      if (mins <= 10) windowTag = "10m";
      else if (mins <= 25) windowTag = "25m";
      else if (mins <= 50) windowTag = "50m";
      else if (mins <= 120) windowTag = "2h";
      if (!windowTag) continue;

      const timeLabel = startTime.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
      const locationText = event.location ? ` in ${event.location}` : "";
      const type = (event.type || "").toLowerCase();
      const isStudy = type === "study" || type === "review" || type === "personal";
      const eventTypeLabel =
        type === "lecture" ? "Class"
          : type === "lab" ? "Lab"
            : type === "seminar" ? "Seminar"
              : type === "exam" ? "Exam"
                : isStudy ? "Study block"
                  : "Event";

      const notifType = isExamLike(event.title, type)
        ? "exam_reminder"
        : isStudy
          ? "study_reminder"
          : "timetable_reminder";

      const when =
        mins <= 1 ? "now"
          : mins < 60 ? `in ${mins} min`
            : `in about ${Math.max(1, Math.round(mins / 60))} h`;

      const sent = await deliverReminder({
        userId,
        type: notifType,
        title: `${eventTypeLabel} ${when}: ${event.title}`,
        body: `Starts at ${timeLabel}${locationText}.`,
        actionUrl: "/app?view=planner",
        dedupeKey: `timetable:${event.id}:${windowTag}:${userId}`,
        tag: `timetable-${event.id}-${windowTag}`,
        requireInteraction: mins <= 15,
        actionTitle: "Open planner",
      });
      if (sent) {
        remindersSent += 1;
        if (isStudy) checked.studyBlocks += 1;
      }
    }
  }

  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const in26Hours = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  const { data: dueTasks, error: tasksError } = await admin
    .from("study_tasks")
    .select("id, title, priority, due_at, status")
    .eq("owner_id", userId)
    .in("status", ["todo", "in_progress"])
    .not("due_at", "is", null)
    .gte("due_at", threeHoursAgo.toISOString())
    .lte("due_at", in26Hours.toISOString());

  if (tasksError) {
    console.warn("[Reminders] study_tasks query failed", tasksError.message);
  }

  if (dueTasks?.length) {
    checked.tasks = dueTasks.length;
    for (const task of dueTasks) {
      if (!task.due_at) continue;
      const dueDate = new Date(task.due_at);
      const mins = minutesUntil(dueDate, now);
      const hrs = hoursUntil(dueDate, now);
      const overdue = mins < 0;
      const high = task.priority === "high";

      let windowTag: string | null = null;
      let titlePrefix = "Task due";
      let body = "";

      if (overdue && mins >= -180) {
        windowTag = "overdue";
        titlePrefix = "Task overdue";
        body = `"${task.title}" was due ${Math.abs(mins) < 60 ? `${Math.abs(mins)}m` : `${Math.abs(hrs)}h`} ago.`;
      } else if (mins >= -2 && mins <= 10) {
        windowTag = "due-now";
        titlePrefix = high ? "High priority task is due" : "Task is due";
        body = mins <= 0
          ? `"${task.title}" is due now.`
          : `"${task.title}" is due in ${mins} minute${mins === 1 ? "" : "s"}.`;
      } else if (mins > 10 && mins <= 60) {
        windowTag = "due-1h";
        titlePrefix = high ? "High priority task due soon" : "Task due soon";
        body = `"${task.title}" is due in ${mins} minutes.`;
      } else if (mins > 60 && mins <= 4 * 60) {
        windowTag = "few-hours";
        titlePrefix = "Task due in a few hours";
        body = `"${task.title}" is due in about ${Math.max(1, hrs)} hour${hrs === 1 ? "" : "s"}.`;
      } else if (mins > 4 * 60 && mins <= 14 * 60) {
        windowTag = "half-day";
        titlePrefix = "Upcoming task";
        body = `"${task.title}" is due in about ${Math.max(1, hrs)} hours.`;
      } else if (mins > 14 * 60 && mins <= 26 * 60) {
        windowTag = "day-ahead";
        titlePrefix = "Task due tomorrow";
        body = `"${task.title}" is due in about ${Math.max(1, hrs)} hours.`;
      }

      if (!windowTag) continue;

      const exam = isExamLike(task.title);
      const assignment = isAssignmentLike(task.title);
      const notifType = exam
        ? "exam_reminder"
        : assignment
          ? "assignment_due"
          : "study_reminder";
      if (exam) titlePrefix = titlePrefix.replace("Task", "Exam");
      else if (assignment) titlePrefix = titlePrefix.replace("Task", "Assignment");

      const sent = await deliverReminder({
        userId,
        type: notifType,
        title: `${titlePrefix}: ${task.title}`,
        body,
        actionUrl: "/app?view=planner",
        dedupeKey: `task:${task.id}:${windowTag}:${userId}`,
        tag: `task-${task.id}-${windowTag}`,
        requireInteraction: overdue || mins <= 60 || high,
        actionTitle: "View tasks",
      });
      if (sent) remindersSent += 1;
    }
  }

  return { remindersSent, checked };
}
