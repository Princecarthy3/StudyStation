import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications/service";
import { processUserReminders } from "@/lib/notifications/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let isTest = false;
  try {
    const json = await request.clone().json() as { test?: boolean };
    isTest = Boolean(json?.test);
  } catch {
    /* empty body is fine */
  }

  let remindersSent = 0;

  if (isTest) {
    await dispatchNotification({
      userIds: [user.id],
      type: "announcement",
      title: "StudyStation Notifications Active",
      body: "Push notifications are working on this device. Task due reminders and class alerts will appear here.",
      actionUrl: "/app?view=planner",
      tag: `test-${Date.now()}`,
    });
    remindersSent += 1;
  }

  const result = await processUserReminders(user.id, admin);
  remindersSent += result.remindersSent;

  return NextResponse.json({
    success: true,
    remindersChecked: result.checked.events + result.checked.tasks,
    remindersSent,
    detail: result.checked,
  });
}
