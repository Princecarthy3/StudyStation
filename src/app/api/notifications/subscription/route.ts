import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Push subscriptions are unavailable." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Sign in to enable notifications." }, { status: 401 });

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  return NextResponse.json({ publicKey });
}

export async function POST(request: Request) {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: "Push subscriptions are unavailable." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Sign in to enable notifications." }, { status: 401 });

  let body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "The push subscription was not valid." }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!/^https:\/\//i.test(endpoint) || !p256dh || !authKey || endpoint.length > 2000) {
    return NextResponse.json({ error: "The browser push subscription was incomplete." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("push_subscriptions").upsert({
    user_id: auth.user.id,
    endpoint,
    p256dh,
    auth: authKey,
    user_agent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });
  if (error) return NextResponse.json({ error: "The browser push subscription could not be saved." }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return NextResponse.json({ error: "Push subscriptions are unavailable." }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ error: "Sign in to disable notifications." }, { status: 401 });

  let endpoint = "";
  try {
    const body = await request.json() as { endpoint?: unknown };
    endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  } catch {
    return NextResponse.json({ error: "The push subscription was not valid." }, { status: 400 });
  }
  if (!endpoint) return NextResponse.json({ error: "The push subscription endpoint is required." }, { status: 400 });

  const { error } = await auth.supabase.from("push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: "The browser push subscription could not be removed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
