import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Checks upcoming timetable events and due tasks for the signed-in user
 * and dispatches timely, deduplicated notifications to Windows Action Center and in-app center.
 */
export async function POST(request: Request) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Database service unavailable." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client unavailable." }, { status: 503 });
  }

  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let remindersSent = 0;

  // 1. Timetable events starting within the next 45 minutes
  const in45Minutes = new Date(now.getTime() + 45 * 60 * 1000);
  const { data: upcomingEvents, error: eventsError } = await admin
    .from("timetable_events")
    .select("id, title, location, type, starts_at, ends_at")
    .eq("user_id", user.id)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", in45Minutes.toISOString());

  if (!eventsError && upcomingEvents) {
    for (const event of upcomingEvents) {
      const startTime = new Date(event.starts_at);
      const minutesRemaining = Math.max(1, Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)));
      const timeLabel = startTime.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const locationText = event.location ? ` in ${event.location}` : "";

      const eventTypeLabel = event.type === "lecture" ? "Lecture" : event.type === "lab" ? "Lab" : "Class";
      const dedupeDate = startTime.toISOString().slice(0, 10);

      await dispatchNotification({
        userIds: [user.id],
        type: "timetable_reminder",
        title: `${eventTypeLabel} in ${minutesRemaining}m: ${event.title}`,
        body: `Starts at ${timeLabel}${locationText}. Don't miss it!`,
        actionUrl: `/app?view=planner`,
        actions: [
          { action: "open", title: "View timetable" },
          { action: "record", title: "Start recording" },
        ],
        dedupeKeyPrefix: `timetable:${event.id}:${dedupeDate}`,
        tag: `timetable-${event.id}`,
      });
      remindersSent += 1;
    }
  }

  // 2. Study tasks & assignments due within the next 24 hours
  const { data: dueTasks, error: tasksError } = await admin
    .from("study_tasks")
    .select("id, title, priority, due_at")
    .eq("owner_id", user.id)
    .eq("status", "todo")
    .not("due_at", "is", null)
    .gte("due_at", now.toISOString())
    .lte("due_at", next24Hours.toISOString());

  if (!tasksError && dueTasks) {
    for (const task of dueTasks) {
      if (!task.due_at) continue;
      const dueDate = new Date(task.due_at);
      const hoursRemaining = Math.max(1, Math.round((dueDate.getTime() - now.getTime()) / (60 * 60 * 1000)));
      const isUrgent = hoursRemaining <= 3 || task.priority === "high";
      const isExam = /exam|quiz|midterm|final/i.test(task.title);

      const dedupeTag = hoursRemaining <= 3 ? "urgent" : "24h";

      await dispatchNotification({
        userIds: [user.id],
        type: isExam ? "exam_reminder" : "assignment_due",
        title: isExam ? `Exam reminder: ${task.title}` : `Assignment due: ${task.title}`,
        body: `Due in approx. ${hoursRemaining} hour${hoursRemaining === 1 ? "" : "s"}. Tap to review tasks.`,
        actionUrl: `/app?view=planner`,
        actions: [
          { action: "open", title: "View task" },
        ],
        dedupeKeyPrefix: `task:${task.id}:${dedupeTag}`,
        tag: `task-${task.id}`,
        requireInteraction: isUrgent,
      });
      remindersSent += 1;
    }
  }

  return NextResponse.json({
    success: true,
    remindersChecked: (upcomingEvents?.length ?? 0) + (dueTasks?.length ?? 0),
    remindersSent,
  });
}
