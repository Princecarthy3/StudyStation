import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotification } from "@/lib/notifications/push";

export async function notifyGroupOwnerOfJoin(groupId: string, memberId: string) {
  try {
    const admin = createAdminClient();
    const { data: group, error: groupError } = await admin.from("study_groups")
      .select("creator_id, name")
      .eq("id", groupId)
      .maybeSingle();
    if (groupError || !group || group.creator_id === memberId) return;

    const { data: member } = await admin.from("profiles")
      .select("full_name")
      .eq("id", memberId)
      .maybeSingle();
    const name = member?.full_name?.trim() || "A student";
    const { error } = await admin.from("notifications").insert({
      user_id: group.creator_id,
      type: "study_group_join",
      title: "New study group member",
      body: `${name} joined ${group.name}.`,
      action_url: "/app?view=study-groups",
      dedupe_key: `study-group-join:${groupId}:${memberId}`,
    });
    if (error) console.error("Study group join notification failed", { code: error.code });
    else {
      await sendPushNotification([group.creator_id], {
        type: "study_group_join",
        title: "New study group member",
        body: `${name} joined ${group.name}.`,
        url: "/app?view=study-groups",
      });
    }
  } catch (error) {
    console.error("Study group join notification failed", error instanceof Error ? error.message : "unknown error");
  }
}
