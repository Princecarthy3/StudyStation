import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const defaultCategories = {
  assignments: true,
  calls: true,
  classes: true,
  groups: true,
  messages: true,
  recordings: true,
  system: true,
  study: true,
} as const;

async function getAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

export async function GET() {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: "Notification preferences are unavailable." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Sign in to view notification preferences." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .select("enabled, categories")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Notification preferences could not be loaded." }, { status: 500 });

  return NextResponse.json({
    enabled: data?.enabled ?? true,
    categories: { ...defaultCategories, ...(data?.categories ?? {}) },
  });
}

export async function PUT(request: Request) {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: "Notification preferences are unavailable." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Sign in to update notification preferences." }, { status: 401 });

  let body: { enabled?: unknown; categories?: unknown };
  try {
    body = await request.json() as { enabled?: unknown; categories?: unknown };
  } catch {
    return NextResponse.json({ error: "The notification preferences were not valid." }, { status: 400 });
  }

  const categories = body.categories && typeof body.categories === "object" && !Array.isArray(body.categories)
    ? Object.fromEntries(Object.entries(body.categories).map(([key, value]) => [key, value === true]))
    : defaultCategories;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

  const { data, error } = await auth.supabase
    .from("notification_preferences")
    .upsert({
      user_id: auth.user.id,
      enabled,
      categories,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("enabled, categories")
    .single();
  if (error) return NextResponse.json({ error: "Notification preferences could not be saved." }, { status: 500 });

  return NextResponse.json({
    enabled: data.enabled,
    categories: { ...defaultCategories, ...(data.categories ?? {}) },
  });
}
