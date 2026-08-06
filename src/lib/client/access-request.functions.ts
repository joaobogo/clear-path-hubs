import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AREA_LABELS, AREA_ROLES, COLLABORATOR_ROLES, type WorkspaceArea } from "@/lib/collaborator-roles";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const AREA_KEYS = Object.keys(AREA_ROLES) as WorkspaceArea[];

/**
 * A collaborator who hits a control their role cannot use can ask the workspace
 * admins for it, in one click, from the place they were blocked. The admins get
 * a notification naming the person, the area and where they were.
 */
export const requestWorkspaceAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; area: string; note?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        area: z.enum(AREA_KEYS as [WorkspaceArea, ...WorkspaceArea[]]),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const s = context.supabase as AnyRow;
    // The caller must be a member of the workspace they are asking about.
    await assertWorkspaceAccess(context.supabase, context.userId, data.orgId);
    const { data: mine } = await s
      .from("memberships")
      .select("id, role")
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!mine) throw new Error("forbidden");

    const { data: me } = await s
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const who = (me as AnyRow)?.full_name || "A teammate";

    const { data: admins } = await s
      .from("memberships")
      .select("user_id")
      .eq("organization_id", data.orgId)
      .eq("role", "client_admin")
      .eq("status", "active");

    const recipients = ((admins as AnyRow[]) ?? [])
      .map((a) => a.user_id as string)
      .filter((id) => id && id !== context.userId);

    if (recipients.length === 0) {
      return { ok: true, notified: 0, reason: "no_admin" as const };
    }

    const required = AREA_ROLES[data.area as WorkspaceArea]
      .map((r) => COLLABORATOR_ROLES[r].label)
      .join(" or ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as AnyRow).from("notifications").insert(
      recipients.map((user_id) => ({
        recipient_user_id: user_id,
        audience: "client" as const,
        event_type: "approval_needed" as const,
        organization_id: data.orgId,
        title: `${who} is asking for access to ${AREA_LABELS[data.area as WorkspaceArea].toLowerCase()}`,
        body: `${who} needs the ${required} role to use it.${data.note ? ` They added: “${data.note}”` : ""}`,
        link_path: "/client/account?tab=team",
        entity_type: "memberships",
        entity_id: (mine as AnyRow).id as string,
      })),
    );
    if (error) throw new Error(error.message);

    return { ok: true, notified: recipients.length, reason: null };
  });
