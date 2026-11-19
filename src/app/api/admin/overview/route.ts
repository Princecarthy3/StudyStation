import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const startTime = Date.now();

    // Run parallel analytical queries using Supabase Admin
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const inactiveCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profilesRes,
      authUsersRes,
      lecturesRes,
      aiGensRes,
      notesRes,
      reviewsRes,
      groupsRes,
      recentSignupsRes,
      recentLecturesRes,
      recentAiRes,
      storageBucketsRes,
      sessionsRes,
      eventsRes,
    ] = await Promise.all([
      // 1. All profiles count & onboarding stats (only valid columns)
      adminClient.from("profiles").select("id, onboarding_complete, full_name, university"),
      // 2. All auth accounts to accurately count registered students
      adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      // 3. All lectures status, source, duration
      adminClient.from("lectures").select("id, status, source_type, duration_seconds"),
      // 4. AI generations status & tasks
      adminClient.from("ai_generations").select("id, status, task, model"),
      // 5. Notes count
      adminClient.from("notes").select("id", { count: "exact", head: true }),
      // 6. Student reviews rating
      adminClient.from("student_reviews").select("id, rating"),
      // 7. Study groups count
      adminClient.from("study_groups").select("id", { count: "exact", head: true }),
      // 8. Recent 6 signups
      adminClient
        .from("profiles")
        .select("id, full_name, university, degree, country_name, created_at, onboarding_complete")
        .order("created_at", { ascending: false })
        .limit(6),
      // 9. Recent 6 lectures
      adminClient
        .from("lectures")
        .select("id, user_id, title, source_type, status, duration_seconds, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      // 10. Recent 6 AI generations
      adminClient
        .from("ai_generations")
        .select("id, owner_id, task, status, model, created_at, error_code")
        .order("created_at", { ascending: false })
        .limit(6),
      // 11. Check storage bucket
      adminClient.storage.listBuckets(),
      // 12. App sessions (may be empty before migration)
      adminClient
        .from("app_sessions")
        .select("id, user_id, started_at, last_seen_at, duration_seconds")
        .gte("last_seen_at", monthAgo)
        .limit(5000),
      // 13. Feature usage events (last 30 days)
      adminClient
        .from("usage_events")
        .select("feature, user_id, created_at")
        .gte("created_at", monthAgo)
        .limit(10000),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    // Profiles & Auth accounts analytics
    const profiles = profilesRes.data ?? [];
    const authUsers = authUsersRes.data?.users ?? [];
    const totalStudents = Math.max(authUsers.length, profiles.length);
    const onboardedStudents = profiles.filter((p) => p.onboarding_complete).length;
    const pendingOnboarding = Math.max(0, totalStudents - onboardedStudents);
    const tourCompleted = onboardedStudents;

    // Lectures analytics
    const lectures = lecturesRes.data ?? [];
    const totalLectures = lectures.length;
    const lecturesByStatus = {
      ready: lectures.filter((l) => l.status === "ready").length,
      processing: lectures.filter((l) => l.status === "processing").length,
      uploaded: lectures.filter((l) => l.status === "uploaded").length,
      failed: lectures.filter((l) => l.status === "failed").length,
    };
    const lecturesBySource = {
      recording: lectures.filter((l) => l.source_type === "recording").length,
      audio: lectures.filter((l) => l.source_type === "audio").length,
      video: lectures.filter((l) => l.source_type === "video").length,
      document: lectures.filter((l) => l.source_type === "document").length,
      link: lectures.filter((l) => l.source_type === "link").length,
    };
    const totalDurationSeconds = lectures.reduce((acc, l) => acc + (l.duration_seconds || 0), 0);
    const totalAudioMinutes = Math.round(totalDurationSeconds / 60);

    // AI generations analytics
    const aiGens = aiGensRes.data ?? [];
    const totalAiGenerations = aiGens.length;
    const completedAiGenerations = aiGens.filter((a) => a.status === "completed").length;
    const failedAiGenerations = aiGens.filter((a) => a.status === "failed").length;
    const aiSuccessRate = totalAiGenerations > 0
      ? Math.round((completedAiGenerations / totalAiGenerations) * 100)
      : 100;
    const aiByTask = {
      summary: aiGens.filter((a) => a.task === "summary").length,
      quiz: aiGens.filter((a) => a.task === "quiz").length,
      flashcards: aiGens.filter((a) => a.task === "flashcards").length,
      question: aiGens.filter((a) => a.task === "question").length,
    };

    // Reviews analytics
    const reviews = reviewsRes.data ?? [];
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;
    const ratingBreakdown = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    // Storage status
    const buckets = storageBucketsRes.data ?? [];
    const lecturesBucketExists = buckets.some((b) => b.name === "lectures");

    // --- Engagement metrics (sessions + auth last_sign_in fallback) ---
    const sessions = (!sessionsRes.error && sessionsRes.data) ? sessionsRes.data : [];
    const events = (!eventsRes.error && eventsRes.data) ? eventsRes.data : [];

    const uniqueFrom = (rows: Array<{ user_id?: string | null }>, sinceIso: string, field: "last_seen_at" | "started_at" = "last_seen_at") => {
      const set = new Set<string>();
      for (const row of rows as Array<Record<string, string>>) {
        const ts = row[field];
        const uid = row.user_id;
        if (uid && ts && ts >= sinceIso) set.add(uid);
      }
      return set;
    };

    const sessionDau = uniqueFrom(sessions, dayAgo);
    const sessionWau = uniqueFrom(sessions, weekAgo);
    const sessionMau = uniqueFrom(sessions, monthAgo);

    // Fallback: auth last_sign_in_at when session table is empty/new
    const authDau = new Set<string>();
    const authWau = new Set<string>();
    const authMau = new Set<string>();
    const authActive14d = new Set<string>();
    for (const u of authUsers) {
      const last = ((u as { last_sign_in_at?: string | null }).last_sign_in_at || null) as string | null;
      if (!last) continue;
      const id = u.id as string;
      if (last >= dayAgo) authDau.add(id);
      if (last >= weekAgo) authWau.add(id);
      if (last >= monthAgo) authMau.add(id);
      if (last >= inactiveCutoff) authActive14d.add(id);
    }

    const useSessions = sessions.length > 0;
    const dau = useSessions ? sessionDau.size : authDau.size;
    const wau = useSessions ? sessionWau.size : authWau.size;
    const mau = useSessions ? sessionMau.size : authMau.size;

    // Session duration: prefer duration_seconds, else last_seen - started
    let totalUsageSeconds = 0;
    let sessionCountForAvg = 0;
    for (const s of sessions) {
      let dur = typeof s.duration_seconds === "number" ? s.duration_seconds : 0;
      if (dur <= 0 && s.started_at && s.last_seen_at) {
        dur = Math.max(0, Math.round((new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime()) / 1000));
      }
      // Cap pathological heartbeats at 6 hours per session
      dur = Math.min(dur, 6 * 60 * 60);
      if (dur > 0) {
        totalUsageSeconds += dur;
        sessionCountForAvg += 1;
      }
    }
    const averageSessionSeconds = sessionCountForAvg > 0 ? Math.round(totalUsageSeconds / sessionCountForAvg) : 0;
    const activeUserCountForAvg = useSessions ? sessionMau.size : Math.max(authMau.size, 1);
    const averageTimePerUserSeconds = activeUserCountForAvg > 0 ? Math.round(totalUsageSeconds / activeUserCountForAvg) : 0;

    // Most used features
    const featureCounts = new Map<string, number>();
    for (const e of events) {
      const key = (e.feature || "other") as string;
      featureCounts.set(key, (featureCounts.get(key) || 0) + 1);
    }
    // Fallback feature popularity from product tables when events empty
    if (featureCounts.size === 0) {
      featureCounts.set("studio", lecturesBySource.recording + lecturesBySource.audio + lecturesBySource.video + lecturesBySource.document);
      featureCounts.set("assistant", aiByTask.question);
      featureCounts.set("study_lab", aiByTask.quiz + aiByTask.flashcards + aiByTask.summary);
      featureCounts.set("groups", groupsRes.count ?? 0);
      featureCounts.set("notes", notesRes.count ?? 0);
    }
    const mostUsedFeatures = [...featureCounts.entries()]
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const registeredIds = new Set((profilesRes.data ?? []).map((p) => p.id as string));
    if (registeredIds.size === 0) {
      for (const u of authUsers) registeredIds.add(u.id as string);
    }
    let inactiveUsers = 0;
    if (useSessions) {
      const active14 = uniqueFrom(sessions, inactiveCutoff);
      for (const id of registeredIds) {
        if (!active14.has(id)) inactiveUsers += 1;
      }
    } else {
      for (const id of registeredIds) {
        if (!authActive14d.has(id)) inactiveUsers += 1;
      }
    }

    return NextResponse.json({
      metrics: {
        totalStudents,
        onboardedStudents,
        pendingOnboarding: totalStudents - onboardedStudents,
        tourCompleted,
        totalLectures,
        lecturesByStatus,
        lecturesBySource,
        totalAudioMinutes,
        totalNotes: notesRes.count ?? 0,
        totalAiGenerations,
        completedAiGenerations,
        failedAiGenerations,
        aiSuccessRate,
        aiByTask,
        totalStudyGroups: groupsRes.count ?? 0,
        totalReviews,
        averageRating,
        ratingBreakdown,
        engagement: {
          totalRegisteredUsers: totalStudents,
          dau,
          wau,
          mau,
          averageSessionSeconds,
          totalUsageSeconds,
          averageTimePerUserSeconds,
          mostUsedFeatures,
          inactiveUsers,
          inactiveDays: 14,
          source: useSessions ? "sessions" : "auth_fallback",
        },
      },
      recent: {
        signups: recentSignupsRes.data ?? [],
        lectures: recentLecturesRes.data ?? [],
        aiGenerations: recentAiRes.data ?? [],
      },
      system: {
        databaseOnline: !profilesRes.error,
        dbLatencyMs,
        storageOnline: !storageBucketsRes.error && lecturesBucketExists,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        nodeEnv: process.env.NODE_ENV || "development",
        serverTimestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Admin overview fetch failed:", error);
    return NextResponse.json(
      { error: "Could not compile admin metrics." },
      { status: 500 }
    );
  }
}
