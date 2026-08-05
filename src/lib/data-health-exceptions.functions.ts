/**
 * Data health exception server functions (platform staff only).
 *
 * Repairs are two-phase by design: `previewDataHealthRepair` describes exactly
 * what will change, `applyDataHealthRepair` only runs when the caller echoes
 * back the previewed repair. Every applied repair writes an audit event.
 * No delete path is exposed here — by design.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { repairPreviewLines, REPAIR_LABEL } from "./data-health-exceptions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function staffAdmin(context: Any) {
  const { data: staff } = await context.supabase.rpc("is_platform_staff", {
    _user: context.userId,
  });
  if (!staff) throw new Error("Only platform staff can view data health exceptions.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Any;
}

const traceId = () =>
  `dh_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

async function writeAudit(
  admin: Any,
  opts: {
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string;
    organization_id?: string | null;
    before?: unknown;
    after?: unknown;
    trace_id: string;
  },
) {
  await admin.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
    trace_id: opts.trace_id,
  });
}

export const getDataHealthExceptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { includeTest?: boolean } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context);
    const { loadDataHealthExceptions } = await import("./data-health-exceptions.server");
    return await loadDataHealthExceptions(admin, { includeTest: data.includeTest ?? false });
  });

export const previewDataHealthRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string().min(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context);
    const { findException } = await import("./data-health-exceptions.server");
    const ex = await findException(admin, data.key);
    if (!ex) return { found: false as const };
    return {
      found: true as const,
      exception: ex,
      repair: ex.repair,
      repair_label: REPAIR_LABEL[ex.repair],
      changes: repairPreviewLines(ex),
    };
  });

export const applyDataHealthRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        key: z.string().min(3),
        /** Must equal the repair returned by the preview call. */
        previewed_repair: z.enum(["acknowledge_orphan", "realign_match_org", "retry_parse"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await staffAdmin(context);
    const { findException } = await import("./data-health-exceptions.server");
    const ex = await findException(admin, data.key);
    if (!ex) throw new Error("This exception is no longer present — reload the list.");
    if (ex.repair !== data.previewed_repair) {
      throw new Error("The record changed since the preview. Preview the repair again.");
    }

    const trace_id = traceId();

    if (ex.repair === "acknowledge_orphan") {
      const { data: before } = await admin
        .from("scoring_orphans")
        .select("id, resolved_at, resolution_note, organization_id")
        .eq("id", ex.record_id)
        .maybeSingle();
      const { error } = await admin
        .from("scoring_orphans")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: context.userId,
          resolution_note: data.note ?? "Acknowledged from data health exceptions.",
        })
        .eq("id", ex.record_id);
      if (error) throw new Error(error.message);
      await writeAudit(admin, {
        actor: context.userId,
        action: "data_health.orphan.acknowledged",
        entity_type: "scoring_orphan",
        entity_id: ex.record_id,
        organization_id: ex.organization_id,
        before,
        after: { resolved: true, note: data.note ?? null },
        trace_id,
      });
      return { ok: true as const, trace_id, repair: ex.repair };
    }

    if (ex.repair === "realign_match_org") {
      const { data: match } = await admin
        .from("candidate_matches")
        .select("id, organization_id, position_id, positions:position_id(organization_id)")
        .eq("id", ex.record_id)
        .maybeSingle();
      const target = (match as Any)?.positions?.organization_id as string | undefined;
      if (!match || !target) throw new Error("Could not resolve the position's client.");
      const { error } = await admin
        .from("candidate_matches")
        .update({ organization_id: target })
        .eq("id", ex.record_id);
      if (error) throw new Error(error.message);
      await writeAudit(admin, {
        actor: context.userId,
        action: "data_health.match.org_realigned",
        entity_type: "candidate_match",
        entity_id: ex.record_id,
        organization_id: target,
        before: { organization_id: (match as Any).organization_id },
        after: { organization_id: target, note: data.note ?? null },
        trace_id,
      });
      return { ok: true as const, trace_id, repair: ex.repair };
    }

    // retry_parse — reuse the existing pipeline step, nothing bespoke.
    if (!ex.candidate_match_id) throw new Error("No match attached to this file.");
    const { runHydrationOnly } = await import("./pipeline-runner.server");
    const outcome = await runHydrationOnly(ex.candidate_match_id);
    await writeAudit(admin, {
      actor: context.userId,
      action: "data_health.file.parse_retried",
      entity_type: "candidate_match",
      entity_id: ex.candidate_match_id,
      organization_id: ex.organization_id,
      before: { file_id: ex.record_id, detail: ex.detail },
      after: { state: outcome.final_state, note: data.note ?? null },
      trace_id,
    });
    return { ok: true as const, trace_id, repair: ex.repair, state: outcome.final_state };
  });
