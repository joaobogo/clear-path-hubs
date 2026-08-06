// Role closure — server functions.
//
// Closing is a single atomic write: reason, note, close date and closer are
// recorded on the position in one update. Nothing is deleted — candidates,
// decisions and history stay readable in the archive. A failed write leaves the
// role exactly as it was, so the UI must never close optimistically.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";
import {
  CLOSE_NOTE_MAX,
  CLOSE_REASONS,
  CLOSE_REASON_LABEL,
  statusForReason,
  validateCloseRole,
  isCloseReason,
  type CloseRoleReason,
  type RoleClosureSummary,
} from "@/lib/role-closure";

const closeInputZ = z.object({
  orgId: z.string().uuid(),
  positionId: z.string().uuid(),
  reason: z.enum(CLOSE_REASONS),
  note: z.string().trim().max(CLOSE_NOTE_MAX).optional(),
  restartDate: z.string().trim().max(10).optional(),
});

export const getRoleClosure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string }) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<RoleClosureSummary | null> => {
    const { loadRoleClosure } = await import("@/lib/role-closure.server");
    return loadRoleClosure(context.supabase, data);
  });

export const closeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => closeInputZ.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Closing a role is a role-settings decision, not a viewer action.
    await assertWorkspaceArea(supabase, userId, data.orgId, "role_settings");

    const check = validateCloseRole(data);
    if (!check.ok) {
      const first =
        check.errors.reason ?? check.errors.restartDate ?? check.errors.note ?? "Invalid request";
      throw new Error(first);
    }

    const { data: before, error: readError } = await supabase
      .from("positions")
      .select("id, title, status, closed_at, closure_reason")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!before) throw new Error("We couldn't find this role.");

    const reason = data.reason as CloseRoleReason;
    const nextStatus = statusForReason(reason);
    const closedAt = new Date().toISOString();
    const note = (data.note ?? "").trim();

    const { error: writeError } = await supabase
      .from("positions")
      .update({
        status: nextStatus,
        closed_at: closedAt,
        closure_reason: reason,
        closure_note: note ? note : null,
        closed_by: userId,
        restart_expected_on: reason === "on_hold" ? (data.restartDate ?? null) : null,
      } as never)
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId);
    // No partial state: if the single update fails, the role stays open.
    if (writeError) throw new Error(writeError.message);

    const title = String((before as { title: string }).title ?? "Role");
    const label = CLOSE_REASON_LABEL[reason];

    // Recruiting team is notified; failures here never undo the close.
    try {
      await supabase.rpc("notify_platform_staff", {
        _organization_id: data.orgId,
        _event_type: reason === "on_hold" ? "position_paused" : "position_closed",
        _title: `${title} — ${label}`,
        _body: note
          ? `Client closed the role (${label}). Note: ${note}`
          : `Client closed the role (${label}).`,
        _link_path: `/admin/positions/${data.positionId}`,
      } as never);
    } catch (err) {
      console.error("[role-closure] staff notification failed", err);
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { emitProductEvent } = await import("@/lib/product-events.server");
      await emitProductEvent(supabaseAdmin as never, {
        event: "position.closed",
        entityId: data.positionId,
        organizationId: data.orgId,
        actorUserId: userId,
        before: { status: (before as { status: string }).status },
        after: {
          status: nextStatus,
          closure_reason: reason,
          restart_expected_on: reason === "on_hold" ? (data.restartDate ?? null) : null,
          has_note: Boolean(note),
        },
      });
    } catch (err) {
      console.error("[role-closure] event emit failed", err);
    }

    return { status: nextStatus, closedAt, reason, paused: nextStatus === "paused" };
  });
