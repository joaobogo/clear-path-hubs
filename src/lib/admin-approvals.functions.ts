// Thin server-function wrappers for the admin approvals inbox.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { APPROVAL_KINDS, MIN_DECLINE_REASON, bulkEligible } from "./admin-approvals";
import type { ApprovalsPayload } from "./admin-approvals";

const kind = z.enum(APPROVAL_KINDS);

export const getApprovalsInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ include_test: z.boolean().optional().default(false) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<ApprovalsPayload> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadApprovals } = await import("./admin-approvals.server");
    return loadApprovals(supabaseAdmin as never, { includeTest: data.include_test });
  });

export const approveApprovalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        kind,
        target_id: z.string().uuid(),
        match_ids: z.array(z.string().uuid()).max(200).optional(),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { approveApproval } = await import("./admin-approvals.server");
    // The actor is always the authenticated caller; it is never accepted as input.
    return approveApproval(supabaseAdmin as never, { ...data, actor_user_id: context.userId });
  });

/**
 * Bulk approve is deliberately narrow: one kind, one position, one client.
 * The server re-checks the invariant so a crafted request cannot cross clients.
 */
export const bulkApproveApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        kind,
        position_id: z.string().uuid(),
        target_ids: z.array(z.string().uuid()).min(1).max(100),
        reason: z.string().trim().max(1000).optional(),
      })
      .strict()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { approveApproval } = await import("./admin-approvals.server");

    if (data.kind !== "candidate_visible" && data.kind !== "publish_position") throw new Error("bulk_unsupported_kind");

    const table = data.kind === "candidate_visible" ? "candidate_matches" : "positions";
    const select = data.kind === "candidate_visible" ? "id, position_id, organization_id" : "id, organization_id";
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select(select)
      .in("id", data.target_ids);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (rows ?? []) as any[];
    if (list.length !== data.target_ids.length) throw new Error("bulk_target_mismatch");
    const orgs = new Set(list.map((r) => r.organization_id));
    if (orgs.size !== 1) throw new Error("bulk_across_clients_forbidden");
    if (data.kind === "candidate_visible" && list.some((r) => r.position_id !== data.position_id))
      throw new Error("bulk_across_positions_forbidden");

    const approved: string[] = [];
    const errors: { target_id: string; message: string }[] = [];
    for (const id of data.target_ids) {
      try {
        await approveApproval(supabaseAdmin as never, {
          kind: data.kind,
          target_id: id,
          reason: data.reason ?? null,
          // Actor is server-derived from the authenticated session, never from the request payload.
          actor_user_id: context.userId,
        });
        approved.push(id);
      } catch (e) {
        errors.push({ target_id: id, message: e instanceof Error ? e.message : "failed" });
      }
    }
    return { ok: errors.length === 0, approved, errors };
  });

export const declineApprovalItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        kind,
        target_id: z.string().uuid(),
        reason: z.string().trim().min(MIN_DECLINE_REASON).max(1000),
      })
      .strict()
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { declineApproval } = await import("./admin-approvals.server");
    return declineApproval(supabaseAdmin as never, { ...data, actor_user_id: context.userId });
  });
