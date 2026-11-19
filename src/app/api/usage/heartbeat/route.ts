import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURES = new Set([
  "home",
  "studio",
  "record",
  "assistant",
  "study_lab",
  "groups",
  "planner",
  "courses",
  "profile",
  "progress",
  "notifications",
  "other",
]);

function clientLabel(request: Request) {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod|ios/.test(ua)) return "ios";
  return "web";
}

export async function POST(request: Request) {
  let body: { sessionId?: unknown; feature?: unknown; end?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const nowIso = now.toISOString();
  const featureRaw = typeof body.feature === "string" ? body.feature.trim().toLowerCase() : "";
  const feature = FEATURES.has(featureRaw) ? featureRaw : featureRaw ? "other" : null;
  const end = body.end === true;
  let sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

  try {
    if (sessionId) {
      const { data: existing } = await supabase
        .from("app_sessions")
        .select("id, started_at, last_seen_at")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const started = new Date(existing.started_at).getTime();
        const durationSeconds = Math.max(0, Math.round((now.getTime() - started) / 1000));
        await supabase
          .from("app_sessions")
          .update({
            last_seen_at: nowIso,
            duration_seconds: durationSeconds,
            ended_at: end ? nowIso : null,
          })
          .eq("id", existing.id)
          .eq("user_id", user.id);
      } else {
        sessionId = null;
      }
    }

    if (!sessionId) {
      const { data: created, error } = await supabase
        .from("app_sessions")
        .insert({
          user_id: user.id,
          started_at: nowIso,
          last_seen_at: nowIso,
          duration_seconds: 0,
          client: clientLabel(request),
        })
        .select("id")
        .single();
      if (error || !created) {
        // Table may not be migrated yet — soft-fail so the app stays usable.
        return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
      }
      sessionId = created.id;
    }

    if (feature && sessionId) {
      await supabase.from("usage_events").insert({
        user_id: user.id,
        session_id: sessionId,
        feature,
        event: "view",
      });
    }

    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    console.warn("usage heartbeat failed", error);
    return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
  }
}
