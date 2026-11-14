import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processUserReminders } from "@/lib/notifications/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET?.trim();
  const vercelCron = request.headers.get("x-vercel-cron");

  const authorized =
    Boolean(vercelCron) ||
    (Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`);

  // On Vercel Hobby, cron requests include x-vercel-cron. Also allow when CRON_SECRET is unset
  // only if the Vercel cron header is present.
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Admin client unavailable." }, { status: 503 });
  }

  const { data: subs, error: subError } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .limit(5000);

  if (subError) {
    return NextResponse.json({ error: "Could not load push subscriptions." }, { status: 500 });
  }

  const userIds = [...new Set((subs ?? []).map((s) => s.user_id).filter(Boolean))];

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("enabled", true)
    .limit(5000);

  for (const row of prefs ?? []) {
    if (row.user_id && !userIds.includes(row.user_id)) userIds.push(row.user_id);
  }

  const now = new Date();
  let usersProcessed = 0;
  let remindersSent = 0;
  const errors: string[] = [];

  for (const userId of userIds.slice(0, 400)) {
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
    candidateUsers: userIds.length,
    errors: errors.slice(0, 5),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
