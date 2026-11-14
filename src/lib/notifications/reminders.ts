import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchNotification } from "@/lib/notifications/service";

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
 * Process class, study-block, and task-due reminders for one user.
 */
export async function processUserReminders(
  userId: string,
  admin: SupabaseClient,
  now = new Date(),
) {
  let remindersSent = 0;
  const checked = { events: 0, tasks: 0, studyBlocks: 0 };

  const in60Minutes = new Date(now.getTime() + 60 * 60 * 1000);
  const { data: upcomingEvents } = await admin
    .from("timetable_events")
    .select("id, title, location, type, starts_at, ends_at")
    .eq("user_id", userId)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", in60Minutes.toISOString());

  if (upcomingEvents?.length) {
    checked.events = upcomingEvents.length;
    for (const event of upcomingEvents) {
      const startTime = new Date(event.starts_at);
      const mins = Math.max(1, minutesUntil(startTime, now));
      if (!(mins <= 60 && (mins >= 40 || (mins >= 12 && mins <= 20) || mins <= 6))) {
        continue;
      }
      const timeLabel = startTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
      const windowTag = mins <= 6 ? "5m" : mins <= 20 ? "15m" : "45m";
      const notifType = isExamLike(event.title, type)
        ? "exam_reminder"
        : isStudy
          ? "study_reminder"
          : "timetable_reminder";

      await dispatchNotification({
        userIds: [userId],
        type: notifType,
        title: `${eventTypeLabel} in ${mins}m: ${event.title}`,
        body: `Starts at ${timeLabel}${locationText}.`,
        actionUrl: "/app?view=planner",
        actions: [{ action: "open", title: "Open planner" }],
        dedupeKeyPrefix: `timetable:${event.id}:${windowTag}`,
        tag: `timetable-${event.id}-${windowTag}`,
        requireInteraction: mins <= 6,
      });
      remindersSent += 1;
      if (isStudy) checked.studyBlocks += 1;
    }
  }

  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: dueTasks, error: tasksError } = await admin
    .from("study_tasks")
    .select("id, title, priority, due_at, status")
    .eq("owner_id", userId)
    .in("status", ["todo", "in_progress"])
    .not("due_at", "is", null)
    .gte("due_at", twoHoursAgo.toISOString())
    .lte("due_at", in24Hours.toISOString());

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

      if (overdue && mins >= -120) {
        windowTag = "overdue";
        titlePrefix = "Task overdue";
        body = `"${task.title}" was due ${Math.abs(mins) < 60 ? `${Math.abs(mins)}m` : `${Math.abs(hrs)}h`} ago.`;
      } else if (mins >= 0 && mins <= 30) {
        windowTag = "30m";
        titlePrefix = high ? "High priority task due soon" : "Task due soon";
        body = `"${task.title}" is due in ${Math.max(1, mins)} minute${mins === 1 ? "" : "s"}.`;
      } else if (mins > 30 && mins <= 180) {
        windowTag = "3h";
        titlePrefix = "Task due in a few hours";
        body = `"${task.title}" is due in about ${Math.max(1, hrs)} hour${hrs === 1 ? "" : "s"}.`;
      } else if (mins > 180 && mins <= 24 * 60) {
        if ((mins >= 20 * 60 && mins <= 24 * 60) || (mins >= 11 * 60 && mins <= 14 * 60)) {
          windowTag = mins >= 18 * 60 ? "24h" : "12h";
          titlePrefix = "Upcoming task";
          body = `"${task.title}" is due in about ${Math.max(1, hrs)} hours.`;
        }
      }

      if (!windowTag) continue;

      const exam = isExamLike(task.title);
      const assignment = isAssignmentLike(task.title);
      const notifType = exam ? "exam_reminder" : assignment ? "assignment_due" : "study_reminder";
      if (exam) titlePrefix = titlePrefix.replace("Task", "Exam");
      if (assignment && !exam) titlePrefix = titlePrefix.replace("Task", "Assignment");

      await dispatchNotification({
        userIds: [userId],
        type: notifType,
        title: `${titlePrefix}: ${task.title}`,
        body,
        actionUrl: "/app?view=planner",
        actions: [{ action: "open", title: "View tasks" }],
        dedupeKeyPrefix: `task:${task.id}:${windowTag}`,
        tag: `task-${task.id}-${windowTag}`,
        requireInteraction: overdue || mins <= 30 || high,
      });
      remindersSent += 1;
    }
  }

  return { remindersSent, checked };
}
