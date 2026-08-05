// Rejection and decline reason reporting.
// Reads the canonical `v_rejection_decisions` view (client declines + admin
// score rejections) so counts always reconcile with the decision rows they
// came from. Staff-gated; no inference, no derived reasons.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { reasonLabel } from "./client-decision-reasons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export type RejectionReasonCount = {
  code: string | null;
  label: string;
  total: number;
  client: number;
  admin: number;
};

export type RejectionReasonSummary = {
  total_decisions: number;
  unattributed: number;
  reasons: RejectionReasonCount[];
  recent: Array<{
    decision_id: string;
    surface: string;
    match_id: string;
    reason_code: string | null;
    reason_label: string;
    detail: string | null;
    stage_at_decision: string | null;
    actor_user_id: string | null;
    created_at: string;
  }>;
};

/**
 * Reason counts for a position (or a whole client org). Counts are derived
 * from the same rows listed under `recent`, so the two always agree.
 */
export const getRejectionReasonSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        position_id: z.string().uuid().optional(),
        organization_id: z.string().uuid().optional(),
        date_from: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<RejectionReasonSummary> => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    let q = s
      .from("v_rejection_decisions")
      .select(
        "decision_id,surface,match_id,reason_code,detail,stage_at_decision,actor_user_id,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.position_id) q = q.eq("position_id", data.position_id);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (data.date_from) q = q.gte("created_at", data.date_from);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as AnyRow[];

    const map = new Map<string, RejectionReasonCount>();
    let unattributed = 0;
    for (const r of list) {
      const code: string | null = r.reason_code ?? null;
      if (!code) unattributed += 1;
      const key = code ?? "__none__";
      const entry =
        map.get(key) ??
        ({
          code,
          label: code ? (reasonLabel(code) ?? code) : "No reason recorded (legacy)",
          total: 0,
          client: 0,
          admin: 0,
        } satisfies RejectionReasonCount);
      entry.total += 1;
      if (r.surface === "client") entry.client += 1;
      else entry.admin += 1;
      map.set(key, entry);
    }

    return {
      total_decisions: list.length,
      unattributed,
      reasons: [...map.values()].sort((a, b) => b.total - a.total),
      recent: list.slice(0, 25).map((r) => ({
        decision_id: r.decision_id as string,
        surface: r.surface as string,
        match_id: r.match_id as string,
        reason_code: (r.reason_code ?? null) as string | null,
        reason_label: r.reason_code
          ? (reasonLabel(r.reason_code) ?? (r.reason_code as string))
          : "No reason recorded",
        detail: (r.detail ?? null) as string | null,
        stage_at_decision: (r.stage_at_decision ?? null) as string | null,
        actor_user_id: (r.actor_user_id ?? null) as string | null,
        created_at: r.created_at as string,
      })),
    };
  });

/** Match ids that carry a given rejection reason — powers the index filter. */
export const listMatchIdsByRejectionReason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ reason_code: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: rows, error } = await s
      .from("v_rejection_decisions")
      .select("match_id")
      .eq("reason_code", data.reason_code)
      .limit(5000);
    if (error) throw new Error(error.message);
    return [...new Set(((rows ?? []) as AnyRow[]).map((r) => r.match_id as string))];
  });
