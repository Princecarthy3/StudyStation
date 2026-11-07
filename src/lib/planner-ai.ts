import { createAdminClient } from "@/lib/supabase/admin";

const hourlyLimit = 20;

export async function startPlannerAiRequest(userId: string, feature: "planner_import" | "planner_generation") {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new Error("Server calendar AI is not configured. Set SUPABASE_SERVICE_ROLE_KEY and restart.");
  }

  // Rate limit: count recent completed planner jobs for this user + feature
  let count = 0;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { count: exactCount, error: countError } = await admin
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("status", "completed")
      .gte("created_at", since)
      .contains("input_metadata", { feature });
    if (countError) {
      // Fallback without JSON contains (some PostgREST setups struggle with it)
      console.error("Planner AI rate-limit check failed", { code: countError.code, feature, message: countError.message });
      const { count: looseCount, error: looseError } = await admin
        .from("ai_generations")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("status", "completed")
        .gte("created_at", since);
      if (looseError) {
        console.error("Planner AI loose rate-limit check failed", { code: looseError.code });
        // Do not block generation if rate limit cannot be verified
        count = 0;
      } else {
        count = looseCount ?? 0;
      }
    } else {
      count = exactCount ?? 0;
    }
  } catch (error) {
    console.error("Planner AI rate-limit exception", error);
    count = 0;
  }

  if (count >= hourlyLimit) return { limited: true as const };

  const generationId = crypto.randomUUID();
  const { error: insertError } = await admin.from("ai_generations").insert({
    id: generationId,
    owner_id: userId,
    task: "question",
    status: "processing",
    input_metadata: { feature },
  });
  if (insertError) {
    console.error("Planner AI request tracking failed", { code: insertError.code, feature, message: insertError.message });
    // Tracking failure should not block the actual generation
    return { limited: false as const, admin, generationId: null as string | null };
  }
  return { limited: false as const, admin, generationId };
}

export async function finishPlannerAiRequest(
  request: { admin: ReturnType<typeof createAdminClient>; generationId: string | null },
  status: "completed" | "failed" | "succeeded",
) {
  if (!request.generationId) return;
  // DB enum uses completed/failed (not succeeded)
  const normalized = status === "succeeded" ? "completed" : status;
  const { error } = await request.admin
    .from("ai_generations")
    .update({ status: normalized, updated_at: new Date().toISOString() })
    .eq("id", request.generationId);
  if (error) console.error("Planner AI request status update failed", { code: error.code, status: normalized });
}
