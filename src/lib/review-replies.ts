import { createAdminClient } from "@/lib/supabase/admin";

export type AdminReplyData = {
  reviewId: string;
  replyText: string;
  repliedAt: string;
  adminEmail: string;
};

/**
 * Fetch all admin review replies as a Map<reviewId, AdminReplyData>
 */
export async function getAdminReviewReplies(): Promise<Map<string, AdminReplyData>> {
  const map = new Map<string, AdminReplyData>();
  try {
    const admin = createAdminClient();

    // 1. Try reading directly from student_reviews columns
    try {
      const { data: reviewsWithReply, error: srErr } = await admin
        .from("student_reviews")
        .select("id, admin_reply, admin_reply_at, admin_reply_by")
        .not("admin_reply", "is", null);

      if (!srErr && reviewsWithReply) {
        for (const r of reviewsWithReply) {
          const row = r as unknown as {
            id: string;
            admin_reply?: string | null;
            admin_reply_at?: string | null;
            admin_reply_by?: string | null;
          };
          if (row.admin_reply) {
            map.set(row.id, {
              reviewId: row.id,
              replyText: row.admin_reply,
              repliedAt: row.admin_reply_at || new Date().toISOString(),
              adminEmail: row.admin_reply_by || "studystation.support@gmail.com",
            });
          }
        }
      }
    } catch {
      // Column might not exist yet on remote database
    }

    // 2. Also check fallback resources table for replies saved via metadata
    try {
      const { data: records, error } = await admin
        .from("resources")
        .select("id, title, content")
        .eq("resource_type", "admin_review_reply");

      if (!error && records) {
        for (const record of records) {
          if (record.title && record.content) {
            const content = record.content as {
              reviewId?: string;
              replyText?: string;
              repliedAt?: string;
              adminEmail?: string;
            };
            const reviewId = record.title;
            if (content.replyText && !map.has(reviewId)) {
              map.set(reviewId, {
                reviewId,
                replyText: content.replyText,
                repliedAt: content.repliedAt || new Date().toISOString(),
                adminEmail: content.adminEmail || "studystation.support@gmail.com",
              });
            }
          }
        }
      }
    } catch {
      // Ignore fallback table read errors
    }
  } catch (err) {
    console.error("Error reading admin review replies:", err);
  }
  return map;
}

/**
 * Upsert an admin reply to a review
 */
export async function saveAdminReviewReply(
  reviewId: string,
  replyText: string,
  adminEmail = "studystation.support@gmail.com"
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    // Strategy 1: Attempt to update student_reviews table directly
    const { error: directError } = await admin
      .from("student_reviews")
      .update({
        admin_reply: replyText.trim(),
        admin_reply_at: nowIso,
        admin_reply_by: adminEmail,
      })
      .eq("id", reviewId);

    if (!directError) {
      return true;
    }

    // Strategy 2: Fallback to resources table with a guaranteed valid owner_id
    // to prevent FK constraint (23503) errors.
    const { data: targetReview } = await admin
      .from("student_reviews")
      .select("user_id")
      .eq("id", reviewId)
      .maybeSingle();

    let ownerId = targetReview?.user_id;

    if (!ownerId) {
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
      ownerId = users?.users?.[0]?.id;
    }

    if (!ownerId) {
      console.error("saveAdminReviewReply: No valid user ID found for FK");
      return false;
    }

    const payload = {
      reviewId,
      replyText: replyText.trim(),
      repliedAt: nowIso,
      adminEmail,
    };

    const { data: existing } = await admin
      .from("resources")
      .select("id")
      .eq("resource_type", "admin_review_reply")
      .eq("title", reviewId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("resources")
        .update({
          content: payload,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      return !error;
    } else {
      const { error } = await admin.from("resources").insert({
        owner_id: ownerId,
        title: reviewId,
        resource_type: "admin_review_reply",
        visibility: "private",
        content: payload,
      });
      return !error;
    }
  } catch (err) {
    console.error("Error saving admin review reply:", err);
    return false;
  }
}

/**
 * Delete an admin reply to a review
 */
export async function deleteAdminReviewReply(reviewId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // Clear direct column in student_reviews if available
    try {
      await admin
        .from("student_reviews")
        .update({
          admin_reply: null,
          admin_reply_at: null,
          admin_reply_by: null,
        })
        .eq("id", reviewId);
    } catch {
      // Column might not exist
    }

    // Also delete any fallback row in resources
    await admin
      .from("resources")
      .delete()
      .eq("resource_type", "admin_review_reply")
      .eq("title", reviewId);

    return true;
  } catch (err) {
    console.error("Error deleting admin review reply:", err);
    return false;
  }
}
