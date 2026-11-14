import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "schedule";
  const siteUrl = getSiteUrl();

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({
      siteUrl,
      error: "Service unavailable",
    });
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated state - safe for public/unlocked Windows screen
    return NextResponse.json({
      siteUrl,
      isAuthenticated: false,
      summaryText: "Sign in to view your personalized study dashboard.",
      events: [],
      tasks: [],
      studyHours: "0",
      completedTasks: "0",
      readyLectures: "0",
      countdown: "Sign in to StudyStation",
      progressMotivator: "Sign in to StudyStation to sync your timetable, tasks, and notes.",
    }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  if (type === "schedule") {
    const { data: events } = await supabase
      .from("timetable_events")
      .select("id, title, location, type, starts_at, ends_at, courses(code)")
      .eq("user_id", user.id)
      .gte("starts_at", startOfDay)
      .lte("starts_at", endOfDay)
      .order("starts_at", { ascending: true })
      .limit(5);

    const formattedEvents = (events || []).map((e) => {
      const startTime = new Date(e.starts_at);
      const endTime = new Date(e.ends_at);
      const timeStr = `${startTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${endTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
      const course = Array.isArray(e.courses) ? e.courses[0] : e.courses;
      return {
        id: e.id,
        title: e.title,
        time: timeStr,
        location: e.location || "",
        courseCode: course?.code || "",
      };
    });

    // Find next upcoming class for countdown
    const nextClass = (events || []).find((e) => new Date(e.starts_at).getTime() > now.getTime());
    let countdown = "All classes completed today";
    if (nextClass) {
      const diffMs = new Date(nextClass.starts_at).getTime() - now.getTime();
      const diffMins = Math.max(1, Math.round(diffMs / (60 * 1000)));
      countdown = diffMins > 60
        ? `Next: ${nextClass.title} in ${Math.round(diffMins / 60)}h`
        : `Next: ${nextClass.title} in ${diffMins} min`;
    } else if (formattedEvents.length === 0) {
      countdown = "No classes scheduled for today";
    }

    return NextResponse.json({
      siteUrl,
      isAuthenticated: true,
      countdown,
      events: formattedEvents,
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  if (type === "reminders") {
    const { data: tasks } = await supabase
      .from("study_tasks")
      .select("id, title, priority, due_at")
      .eq("owner_id", user.id)
      .eq("status", "todo")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(4);

    const formattedTasks = (tasks || []).map((t) => {
      let dueLabel = "No deadline";
      if (t.due_at) {
        const d = new Date(t.due_at);
        const days = Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        dueLabel = days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
      }
      return {
        id: t.id,
        title: t.title,
        dueLabel,
        priorityLabel: t.priority.toUpperCase(),
        isHighPriority: t.priority === "high",
      };
    });

    return NextResponse.json({
      siteUrl,
      isAuthenticated: true,
      summaryText: formattedTasks.length > 0 ? `${formattedTasks.length} pending task(s)` : "All tasks completed!",
      tasks: formattedTasks,
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  if (type === "progress") {
    // Count completed tasks
    const { count: completedCount } = await supabase
      .from("study_tasks")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "completed");

    // Count ready lectures
    const { count: readyLectureCount } = await supabase
      .from("lectures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "ready");

    const studyHours = Math.max(1, Math.round(((completedCount || 0) * 45 + (readyLectureCount || 0) * 50) / 60));

    return NextResponse.json({
      siteUrl,
      isAuthenticated: true,
      studyHours: String(studyHours),
      completedTasks: String(completedCount || 0),
      readyLectures: String(readyLectureCount || 0),
      progressMotivator: "Keep up the momentum! You're making steady progress across your courses this semester.",
    }, { headers: { "Cache-Control": "private, max-age=120" } });
  }

  // Quick actions
  return NextResponse.json({
    siteUrl,
    isAuthenticated: true,
  }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
