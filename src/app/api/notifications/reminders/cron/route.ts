import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUserReminders } from "@/lib/notifications/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const vercelCron = request.headers.get("x-vercel-cron");
  if (vercelCron) return true;

  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") || "";
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret") || "";
  if (headerSecret === cronSecret) return true;

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") === cronSecret) return true;
  } catch {
    /* ignore */
  }

  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client unavailable." }, { status: 503 });
  }

  const userIds = new Set<string>();

  const { data: subs, error: subError } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .limit(8000);
  if (subError) {
    console.warn("[Reminders cron] push_subscriptions", subError.message);
  }
  for (const row of subs ?? []) {
    if (row.user_id) userIds.add(row.user_id);
  }

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("enabled", true)
    .limit(8000);
  for (const row of prefs ?? []) {
    if (row.user_id) userIds.add(row.user_id);
  }

  const horizonStart = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const horizonEnd = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
  const { data: dueOwners } = await admin
    .from("study_tasks")
    .select("owner_id")
    .in("status", ["todo", "in_progress"])
    .not("due_at", "is", null)
    .gte("due_at", horizonStart)
    .lte("due_at", horizonEnd)
    .limit(8000);
  for (const row of dueOwners ?? []) {
    if (row.owner_id) userIds.add(row.owner_id);
  }

  const soonEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: eventOwners } = await admin
    .from("timetable_events")
    .select("user_id")
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", soonEnd)
    .limit(8000);
  for (const row of eventOwners ?? []) {
    if (row.user_id) userIds.add(row.user_id);
  }

  const userIdList = [...userIds];
  const now = new Date();
  let usersProcessed = 0;
  let remindersSent = 0;
  const errors: string[] = [];

  for (const userId of userIdList.slice(0, 500)) {
    try {
      const result = await processUserReminders(userId, admin, now);
      usersProcessed += 1;
      remindersSent += result.remindersSent;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "unknown");
    }
  }

  return NextResponse.json({
    success: true,
    usersProcessed,
    remindersSent,
    candidateUsers: userIdList.length,
    errors: errors.slice(0, 5),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
