import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; resourceId: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResourceRow = {
  id: string;
  title: string;
  resource_type: string;
  content: unknown;
  storage_path: string | null;
  metadata?: unknown;
};

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

  let resource: ResourceRow | null = null;

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
  resource = row as ResourceRow | null;

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
      resource = adminRow as ResourceRow | null;
    } catch {
      // service role unavailable
    }
  }

  if (!resource) {
    return NextResponse.json({ error: "Shared resource not found." }, { status: 404 });
  }

  let content = resource.content;
  const isNoteType = resource.resource_type === "generated_notes"
    || resource.resource_type === "note"
    || resource.resource_type === "notes";
  // Keep structured notes intact for the rendered note view; only truncate huge file-like blobs.
  if (!isNoteType && content && JSON.stringify(content).length > 80_000) {
    content = { truncated: true, message: "Preview is too large. Open the private file instead." };
  }

  let downloadUrl: string | null = null;
  if (resource.storage_path) {
    let lastError: string | undefined;
    const path = resource.storage_path;
    const title = resource.title;

    try {
      const admin = createAdminClient();
      for (const withDownload of [true, false]) {
        const { data, error: storageError } = await admin.storage
          .from("study-resources")
          .createSignedUrl(path, 60 * 15, withDownload ? { download: title } : undefined);
        if (!storageError && data?.signedUrl) {
          downloadUrl = data.signedUrl;
          break;
        }
        lastError = storageError?.message || lastError;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "admin unavailable";
    }

    if (!downloadUrl) {
      for (const withDownload of [true, false]) {
        const { data, error: storageError } = await supabase.storage
          .from("study-resources")
          .createSignedUrl(path, 60 * 15, withDownload ? { download: title } : undefined);
        if (!storageError && data?.signedUrl) {
          downloadUrl = data.signedUrl;
          break;
        }
        lastError = storageError?.message || lastError;
      }
    }

    if (!downloadUrl) {
      console.error("Shared resource signed URL failed", { resourceId, lastError });
      return NextResponse.json({
        error: "This shared file could not be opened. Ask the owner to re-share it, or try again shortly.",
      }, { status: 503 });
    }
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
