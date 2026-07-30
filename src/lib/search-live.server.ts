/**
 * Search-live notification.
 *
 * Sent once, when a role actually starts sourcing. Guarded by
 * positions.search_live_email_at so re-activating a role never re-sends it.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { absoluteUrl } from "@/lib/blueprint-pipeline.server";

type ChannelPlanEntry = { label?: string; key?: string; state?: string };

export async function notifySearchLive(positionId: string): Promise<{ sent: boolean; reason?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabaseAdmin as any;

  const { data: position } = await admin
    .from("positions")
    .select("id, title, organization_id, owner_user_id, channel_plan, search_live_at, search_live_email_at")
    .eq("id", positionId)
    .maybeSingle();
  if (!position) return { sent: false, reason: "position_not_found" };
  if (position.search_live_email_at) return { sent: false, reason: "already_sent" };

  const now = new Date().toISOString();
  if (!position.search_live_at) {
    await admin.from("positions").update({ search_live_at: now }).eq("id", positionId);
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name, primary_contact_email, primary_contact_name")
    .eq("id", position.organization_id)
    .maybeSingle();

  let recipient: string | null = org?.primary_contact_email ?? null;
  let contactName: string | null = (org?.primary_contact_name ?? "").split(" ")[0] || null;
  if (position.owner_user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("auth_user_id", position.owner_user_id)
      .maybeSingle();
    if (profile?.email) {
      recipient = profile.email;
      contactName = (profile.full_name ?? "").split(" ")[0] || contactName;
    }
  }
  if (!recipient) return { sent: false, reason: "no_recipient" };

  // Only real, configured channels are named — never invented activity.
  const channels = Array.isArray(position.channel_plan)
    ? (position.channel_plan as ChannelPlanEntry[])
        .filter((c) => c?.state === "active")
        .map((c) => c.label ?? c.key ?? "")
        .filter(Boolean)
    : [];

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  await sendTemplateEmail("search-live", recipient, {
    idempotencyKey: `search-live-${positionId}`,
    templateData: {
      contactName,
      companyName: org?.name ?? null,
      roleTitle: position.title ?? null,
      channels,
      roleUrl: absoluteUrl(`/client/positions/${positionId}`),
    },
  });

  await admin.from("positions").update({ search_live_email_at: now }).eq("id", positionId);
  return { sent: true };
}
