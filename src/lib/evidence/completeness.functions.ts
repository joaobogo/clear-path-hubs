/**
 * Evidence completeness gate — server functions.
 * Adding/correcting evidence and overriding a gap are human actions only:
 * nothing here writes generated evidence or generated justifications.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadCompleteness } from "./completeness.server";
import { GATE_OVERRIDE_ACTION } from "./completeness";

export const getEvidenceCompleteness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => loadCompleteness(context.supabase, data.matchId));

const addInput = z.object({
  matchId: z.string().uuid(),
  criterionKey: z.string().trim().min(1).max(160),
  criterionLabel: z.string().trim().min(1).max(200),
  passage: z.string().trim().min(10).max(4000),
  result: z.enum(["strong", "partial", "weak", "contradictory", "needs_validation"]),
  sourceKind: z.enum(["cv", "application_answer", "interview", "manual"]).default("manual"),
  note: z.string().trim().max(1000).optional(),
});

/** Reviewer records a piece of evidence they verified themselves. */
export const addManualEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: match, error: matchErr } = await context.supabase
      .from("candidate_matches")
      .select("id, organization_id, candidate_profile_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (matchErr) throw matchErr;
    if (!match) throw new Error("match_not_found");

    // Manual evidence hangs off a dedicated snapshot row so it never mutates
    // an engine-produced extraction.
    const engineVersion = "manual-review";
    const { data: existing } = await context.supabase
      .from("candidate_evidence")
      .select("id")
      .eq("candidate_match_id", data.matchId)
      .eq("engine_version", engineVersion)
      .maybeSingle();

    let snapshotId = existing?.id as string | undefined;
    if (!snapshotId) {
      const { data: created, error: createErr } = await context.supabase
        .from("candidate_evidence")
        .insert({
          candidate_match_id: data.matchId,
          candidate_profile_id: match.candidate_profile_id,
          engine_version: engineVersion,
          extracted: { source: "Reviewer verified" },
        })
        .select("id")
        .single();
      if (createErr || !created) throw createErr ?? new Error("evidence_snapshot_failed");
      snapshotId = created.id;
    }

    const { data: item, error: itemErr } = await context.supabase
      .from("candidate_evidence_items")
      .insert({
        candidate_evidence_id: snapshotId,
        candidate_match_id: data.matchId,
        organization_id: match.organization_id,
        rubric_criterion_key: data.criterionLabel,
        rubric_dimension_key: data.criterionKey,
        match_type: "direct",
        confidence: data.result === "strong" ? 0.9 : 0.6,
        source_passage: data.passage,
        source_location: { entered_by: "reviewer" },
        // The meaning field answers "why does this passage count for this
        // criterion". Echoing the criterion label here made the UI render
        // "Why this counts: Fluent professional English" under a quote about
        // fluent professional English — circular, and it discredits the field
        // everywhere else. The reviewer's note IS their reasoning when they
        // wrote one; otherwise store nothing rather than a tautology.
        // (Criterion matching is unaffected: it also matches on
        // rubric_criterion_key, which carries the label.)
        normalized_meaning: data.note?.trim() || "",
        result: data.result,
        source_kind: data.sourceKind === "manual" ? "Reviewer verified" : data.sourceKind,
        reviewer_status: "accepted",
        reviewer_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        last_reviewed_at: new Date().toISOString(),
        engine_version: engineVersion,
      })
      .select("id")
      .single();
    if (itemErr || !item) throw itemErr ?? new Error("evidence_insert_failed");

    await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      organization_id: match.organization_id,
      entity_type: "candidate_match",
      entity_id: data.matchId,
      action: "evidence_added_manually",
      after_state: {
        evidence_item_id: item.id,
        criterion_key: data.criterionKey,
        criterion_label: data.criterionLabel,
        result: data.result,
        source_kind: data.sourceKind === "manual" ? "Reviewer verified" : data.sourceKind,
      },
    });

    await markScoreStaleAfterEvidenceChange(data.matchId);

    return { ok: true as const, evidenceItemId: item.id };
  });

/**
 * A score is a reading of the evidence, so changing the evidence dates it.
 *
 * The database has had mark_matches_score_stale since the invalidation triggers
 * were added, and the staleness chip has always known how to render the result,
 * but nothing called it when a reviewer touched evidence: they would add a
 * quote, or override a missing must-have, and the number beside it carried on
 * as though nothing had happened.
 *
 * This marks and offers — it does not rescore. Rescoring on someone's behalf
 * would rewrite a figure they are in the middle of reviewing, and the freshness
 * model is explicit that a rescore is never triggered automatically.
 *
 * Failing to flag must not fail the write the reviewer actually asked for; the
 * reconciler picks up anything missed.
 */
async function markScoreStaleAfterEvidenceChange(matchId: string): Promise<void> {
  try {
    // The RPC is granted to service_role only, so it cannot run on the caller's
    // client even though the caller is staff.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("mark_matches_score_stale", {
      _match_ids: [matchId],
      _reason: "evidence_changed",
    });
  } catch (e) {
    console.error("[completeness] could not flag score as stale", e);
  }
}

const overrideInput = z.object({
  matchId: z.string().uuid(),
  criterionKey: z.string().trim().min(1).max(160),
  criterionLabel: z.string().trim().min(1).max(200),
  justification: z.string().trim().min(20).max(2000),
});

/** Override a missing must-have. Justification is mandatory and attributable. */
export const overrideMissingCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => overrideInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = await loadCompleteness(context.supabase, data.matchId);
    const criterion = payload.report.criteria.find((c) => c.key === data.criterionKey);
    if (!criterion) throw new Error("criterion_not_found");
    if (!criterion.required) throw new Error("criterion_not_required");
    if (criterion.status !== "unsupported") throw new Error("criterion_has_evidence");

    const { error } = await context.supabase.from("audit_events").insert({
      actor_user_id: context.userId,
      organization_id: payload.organizationId,
      entity_type: "candidate_match",
      entity_id: data.matchId,
      action: GATE_OVERRIDE_ACTION,
      after_state: {
        criterion_key: data.criterionKey,
        criterion_label: data.criterionLabel,
        justification: data.justification,
      },
    });
    if (error) throw error;
    await markScoreStaleAfterEvidenceChange(data.matchId);
    return { ok: true as const };
  });
