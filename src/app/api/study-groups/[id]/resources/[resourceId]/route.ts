import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; resourceId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { id, resourceId } = await context.params;
  if (!uuidPattern.test(id) || !uuidPattern.test(resourceId)) {
    return NextResponse.json({ error: "Shared resource not found." }, { status: 404 });
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Shared resources are not configured." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to open this resource." }, { status: 401 });

  // Membership check first (explicit, not only via RLS)
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) {
    return NextResponse.json({ error: "Group membership could not be verified." }, { status: 500 });
  }
  if (!membership) {
    return NextResponse.json({ error: "Join this group to open shared resources." }, { status: 403 });
  }

  // Load resource as member (RLS) — fall back to admin if row is blocked but membership is valid
  let resource: {
    id: string;
    title: string;
    resource_type: string;
    content: unknown;
    storage_path: string | null;
    metadata?: unknown;
  } | null = null;

  const { data: row, error } = await supabase
    .from("resources")
    .select("id, title, resource_type, content, storage_path, metadata")
    .eq("id", resourceId)
    .eq("shared_group_id", id)
    .eq("visibility", "group")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Shared resource could not be loaded." }, { status: 500 });
  }
  resource = row;

  if (!resource) {
    try {
      const admin = createAdminClient();
      const { data: adminRow } = await admin
        .from("resources")
        .select("id, title, resource_type, content, storage_path, metadata")
        .eq("id", resourceId)
        .eq("shared_group_id", id)
        .eq("visibility", "group")
        .maybeSingle();
      resource = adminRow;
    } catch {
      // service role unavailable
    }
  }

  if (!resource) {
    return NextResponse.json({ error: "Shared resource not found." }, { status: 404 });
  }

  let content = resource.content;
  if (content && JSON.stringify(content).length > 80_000) {
    // Still allow download; omit huge inline preview
    content = { truncated: true, message: "Preview is too large. Open the private file instead." };
  }

  let downloadUrl: string | null = null;
  if (resource.storage_path) {
    // Prefer service-role signed URL so group members are not blocked by storage RLS edge cases
    let signed: { signedUrl: string } | null = null;
    let lastError: string | undefined;

    async function sign(client: typeof supabase, withDownload: boolean) {
      return client.storage
        .from("study-resources")
        .createSignedUrl(
          resource.storage_path!,
          60 * 15,
          withDownload ? { download: resource.title } : undefined,
        );
    }

    try {
      const admin = createAdminClient();
      for (const withDownload of [true, false]) {
        const { data, error: storageError } = await sign(admin as typeof supabase, withDownload);
        if (!storageError && data?.signedUrl) {
          signed = data;
          break;
        }
        lastError = storageError?.message || lastError;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "admin unavailable";
    }

    if (!signed) {
      for (const withDownload of [true, false]) {
        const { data, error: storageError } = await sign(supabase, withDownload);
        if (!storageError && data?.signedUrl) {
          signed = data;
          break;
        }
        lastError = storageError?.message || lastError;
      }
    }

    if (!signed) {
      console.error("Shared resource signed URL failed", { resourceId, lastError });
      return NextResponse.json({
        error: "This shared file could not be opened. Ask the owner to re-share it, or try again shortly.",
        detail: lastError,
      }, { status: 503 });
    }

    downloadUrl = signed.signedUrl;
  }

  const meta = resource.metadata && typeof resource.metadata === "object"
    ? (resource.metadata as Record<string, unknown>)
    : {};
  const mimeType = typeof meta.mimeType === "string" ? meta.mimeType : null;

  return NextResponse.json({
    resource: {
      id: resource.id,
      title: resource.title,
      resourceType: resource.resource_type,
      content,
      downloadUrl,
      mimeType,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
