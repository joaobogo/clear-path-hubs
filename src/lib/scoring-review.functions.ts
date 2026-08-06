// Admin scoring-review center — queues, full review record, and controlled
// corrections. Every mutation is staff-gated, reason-bearing and audited.
//
// Invariant: a final total can never be typed in on its own. Corrections change
// an evidence item (or eligibility qualifier) with a reason, and the score is
// then recomputed by the engine. `applyReviewDecision(manual_override)` remains
// available for exceptional cases, but this module never exposes a bare total
// edit without an underlying change.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

async function audit(opts: {
  actor: string;
  action: string;
  match_id: string;
  organization_id?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const s = await getAdmin();
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: "candidate_match",
    entity_id: opts.match_id,
    organization_id: opts.organization_id ?? null,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
  });
}

// ─── Queues ──────────────────────────────────────────────────────────────────

export const REVIEW_QUEUES = {
  parse_failed: {
    column: "q_parse_failed",
    label: "Parsing failed",
    hint: "The CV could not be read end to end.",
  },
  low_confidence: {
    column: "q_low_confidence",
    label: "Low-confidence extraction",
    hint: "Evidence confidence below 0.5.",
  },
  missing_critical: {
    column: "q_missing_critical",
    label: "Missing critical evidence",
    hint: "A must-have requirement has no supporting evidence.",
  },
  contradictory: {
    column: "q_contradictory",
    label: "Contradictory evidence",
    hint: "CV and intake answers disagree.",
  },
  gate_unresolved: {
    column: "q_gate_unresolved",
    label: "Critical gate failed or unknown",
    hint: "Eligibility not yet resolved, or resolved as not eligible.",
  },
  score_stale: {
    column: "q_score_stale",
    label: "Score changed after job update",
    hint: "The job was edited after this candidate was scored.",
  },
  manual_review: {
    column: "q_manual_review",
    label: "Needs manual review",
    hint: "Flagged by the pipeline or by a reviewer.",
  },
  ready_for_decision: {
    column: "q_ready_for_decision",
    label: "Ready for client-approval decision",
    hint: "Scored, eligible and awaiting an approve / hold / reject call.",
  },
} as const;

export type ReviewQueueId = keyof typeof REVIEW_QUEUES;
const QUEUE_IDS = Object.keys(REVIEW_QUEUES) as ReviewQueueId[];

export const REVIEW_SORTS = [
  "oldest_first",
  "newest_first",
  "score_desc",
  "score_asc",
  "confidence_asc",
] as const;

const SORT_MAP: Record<
  (typeof REVIEW_SORTS)[number],
  { col: string; asc: boolean }
> = {
  oldest_first: { col: "updated_at", asc: true },
  newest_first: { col: "updated_at", asc: false },
  score_desc: { col: "final_score", asc: false },
  score_asc: { col: "final_score", asc: true },
  confidence_asc: { col: "evidence_confidence", asc: true },
};

/** Counts for every queue, so the sidebar never lies about workload. */
export const getReviewQueueCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const entries = await Promise.all(
      QUEUE_IDS.map(async (id) => {
        const { count } = await s
          .from("v_scoring_review_queue")
          .select("match_id", { count: "exact", head: true })
          .eq(REVIEW_QUEUES[id].column, true);
        return [id, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<ReviewQueueId, number>;
  });

const queueInput = z.object({
  queue: z.string().optional(),
  q: z.string().max(200).optional(),
  organization_id: z.string().uuid().optional(),
  position_id: z.string().uuid().optional(),
  sort: z.enum(REVIEW_SORTS).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listReviewQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => queueInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const limit = data.limit ?? 25;
    const offset = data.offset ?? 0;
    const sort = SORT_MAP[data.sort ?? "oldest_first"];

    let q = s.from("v_scoring_review_queue").select("*", { count: "exact" });
    const queue = data.queue as ReviewQueueId | undefined;
    if (queue && REVIEW_QUEUES[queue]) q = q.eq(REVIEW_QUEUES[queue].column, true);
    if (data.q) {
      const needle = data.q.trim().toLowerCase().replace(/[%,()]/g, " ");
      if (needle) q = q.ilike("search_text", `%${needle}%`);
    }
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    if (data.position_id) q = q.eq("position_id", data.position_id);

    const { data: rows, count, error } = await q
      .order(sort.col, { ascending: sort.asc, nullsFirst: sort.asc })
      .order("match_id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as AnyRow[], total: count ?? 0, limit, offset };
  });

// ─── Review record ───────────────────────────────────────────────────────────

/**
 * Everything a reviewer needs on one screen: job requirements, the rubric
 * configuration that produced the score, evidence per dimension with its
 * provenance, eligibility qualifiers, the current run against the previous run,
 * and the full correction/decision history.
 */
export const getReviewRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: m } = await s
      .from("candidate_matches")
      .select(
        "id,application_id,candidate_profile_id,position_id,organization_id,stage,admin_status,client_visibility,canonical_state,processing_state,processing_error_code,processing_error_message,eligibility_status,integrity_status,recommendation,recommendation_reason,evidence_confidence,contact_released_at,current_score_run_id,approved_score_run_id,created_at,updated_at",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("not_found");

    const [
      profileRes,
      positionRes,
      runsRes,
      itemsRes,
      eligibilityRes,
      overridesRes,
      decisionsRes,
      answersRes,
      auditRes,
      fileRes,
    ] = await Promise.all([
      s
        .from("candidate_profiles")
        .select("id,full_name,email,phone,country,city,headline,years_experience,current_cv_file_id")
        .eq("id", m.candidate_profile_id)
        .maybeSingle(),
      s
        .from("positions")
        .select(
          "id,title,status,updated_at,requirements,preferred_requirements,description,evaluation_weights,seniority,employment_type,organizations(id,name)",
        )
        .eq("id", m.position_id)
        .maybeSingle(),
      s
        .from("score_runs")
        .select(
          "id,score,raw_score,final_score,applied_cap,confidence,evidence_confidence,superseded_at,status,fit_label,fit_band,must_have_coverage,preferred_coverage,contradiction_status,explanation,result,requirement_coverage,completed_at,engine_version,evaluation_method,rubric_version_id,input_hash",
        )
        .eq("candidate_match_id", data.match_id)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(20),
      s
        .from("candidate_evidence_items")
        .select(
          "id,rubric_dimension_key,rubric_criterion_key,result,match_type,confidence,source_passage,source_location,source_kind,source_ref,normalized_meaning,supporting_role,validation_need,integrity_ok,reviewer_status,reviewer_note,reviewed_by,reviewed_at,engine_version,model_version",
        )
        .eq("candidate_match_id", data.match_id)
        .order("rubric_dimension_key", { ascending: true }),
      s
        .from("eligibility_checks")
        .select("id,qualifier_key,qualifier_label,qualifier_kind,status,reason,evidence,updated_at")
        .eq("candidate_match_id", data.match_id)
        .order("qualifier_key", { ascending: true }),
      s
        .from("evidence_overrides")
        .select("id,evidence_item_id,actor_user_id,reason,before_state,after_state,created_at")
        .eq("candidate_match_id", data.match_id)
        .order("created_at", { ascending: false })
        .limit(50),
      s
        .from("score_decisions")
        .select("id,decision_type,approved_score,reason,actor_user_id,created_at,score_run_id")
        .eq("candidate_match_id", data.match_id)
        .order("created_at", { ascending: false })
        .limit(50),
      s
        .from("application_answers")
        .select(
          "id,answer,created_at,screening_questions(question,answer_type,dealbreaker,preferred_answer)",
        )
        .eq("application_id", m.application_id)
        .order("created_at", { ascending: true }),
      s
        .from("audit_events")
        .select("id,action,actor_user_id,created_at,before_state,after_state")
        .eq("entity_type", "candidate_match")
        .eq("entity_id", data.match_id)
        .order("created_at", { ascending: false })
        .limit(50),
      s
        .from("files")
        .select("id,filename,parse_state,parse_error,page_count,created_at")
        .eq("candidate_profile_id", m.candidate_profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const runs = (runsRes.data ?? []) as AnyRow[];
    const currentRun = runs.find((r) => r.id === m.current_score_run_id) ?? runs[0] ?? null;
    const previousRun = currentRun ? runs.find((r) => r.id !== currentRun.id) ?? null : null;

    let rubric: AnyRow = null;
    if (currentRun?.rubric_version_id) {
      const { data: rv } = await s
        .from("rubric_versions")
        .select(
          "id,version_number,status,label,dimensions,weights,anchors,qualifiers,snapshot,approved_at",
        )
        .eq("id", currentRun.rubric_version_id)
        .maybeSingle();
      rubric = rv ?? null;
    }

    return {
      match: m as AnyRow,
      profile: (profileRes.data ?? null) as AnyRow,
      position: (positionRes.data ?? null) as AnyRow,
      rubric,
      currentRun,
      previousRun,
      runs,
      evidenceItems: (itemsRes.data ?? []) as AnyRow[],
      eligibility: (eligibilityRes.data ?? []) as AnyRow[],
      overrides: (overridesRes.data ?? []) as AnyRow[],
      decisions: (decisionsRes.data ?? []) as AnyRow[],
      answers: (answersRes.data ?? []) as AnyRow[],
      audit: (auditRes.data ?? []) as AnyRow[],
      document: (fileRes.data ?? null) as AnyRow,
    };
  });

// ─── Controlled corrections ──────────────────────────────────────────────────

const EVIDENCE_RESULTS = [
  "strong",
  "partial",
  "weak",
  "missing",
  "contradictory",
  "not_applicable",
  "needs_validation",
] as const;

const correctionInput = z.object({
  match_id: z.string().uuid(),
  evidence_item_id: z.string().uuid(),
  reason: z.string().trim().min(8).max(2000),
  patch: z
    .object({
      result: z.enum(EVIDENCE_RESULTS).optional(),
      confidence: z.number().min(0).max(1).optional(),
      normalized_meaning: z.string().max(2000).optional(),
      validation_need: z.string().max(1000).optional(),
      integrity_ok: z.boolean().optional(),
      reviewer_status: z.enum(["accepted", "edited", "rejected"]).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: "No change supplied" }),
  rescore: z.boolean().optional(),
});

/**
 * Correct one evidence dimension with a mandatory reason, snapshot before/after
 * into evidence_overrides, then (optionally) recompute the score so the total
 * always follows from the underlying evidence.
 */
export const correctEvidenceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => correctionInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();

    const { data: before } = await s
      .from("candidate_evidence_items")
      .select("*")
      .eq("id", data.evidence_item_id)
      .maybeSingle();
    if (!before) throw new Error("evidence_not_found");
    if (before.candidate_match_id !== data.match_id) throw new Error("evidence_match_mismatch");

    const patch = {
      ...data.patch,
      reviewer_status: data.patch.reviewer_status ?? "edited",
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
    };

    const { data: after, error } = await s
      .from("candidate_evidence_items")
      .update(patch)
      .eq("id", data.evidence_item_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await s.from("evidence_overrides").insert({
      evidence_item_id: after.id,
      candidate_match_id: data.match_id,
      organization_id: after.organization_id,
      actor_user_id: context.userId,
      reason: data.reason,
      before_state: before,
      after_state: after,
    });

    await audit({
      actor: context.userId,
      action: "evidence_corrected",
      match_id: data.match_id,
      organization_id: after.organization_id,
      before: {
        result: before.result,
        confidence: before.confidence,
        reviewer_status: before.reviewer_status,
      },
      after: { ...data.patch, reason: data.reason },
    });

    let rescored: { ok: boolean; message?: string } = { ok: false, message: "not_requested" };
    if (data.rescore !== false) {
      try {
        const { runPipelineForMatch } = await import("./pipeline-runner.server");
        await runPipelineForMatch(data.match_id, { force: true });
        rescored = { ok: true };
      } catch (e) {
        rescored = { ok: false, message: (e as Error).message };
      }
    }

    return { ok: true as const, item: after as AnyRow, rescored };
  });

/** Resolve an eligibility qualifier by hand, with a reason. Always audited. */
export const setEligibilityDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        check_id: z.string().uuid(),
        status: z.enum(["eligible", "not_eligible", "needs_validation", "excepted"]),
        reason: z.string().trim().min(8).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: before } = await s
      .from("eligibility_checks")
      .select("*")
      .eq("id", data.check_id)
      .maybeSingle();
    if (!before || before.candidate_match_id !== data.match_id) throw new Error("check_not_found");

    const { data: after, error } = await s
      .from("eligibility_checks")
      .update({
        status: data.status,
        reason: data.reason,
        actor_user_id: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.check_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await audit({
      actor: context.userId,
      action: "eligibility_decided",
      match_id: data.match_id,
      organization_id: after.organization_id,
      before: { status: before.status, reason: before.reason },
      after: { status: after.status, reason: after.reason },
    });
    return { ok: true as const, check: after as AnyRow };
  });

/**
 * Request information from the candidate. Records the request and moves the
 * submission to manual review so it stays in the queue until answered.
 */
export const requestCandidateInformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        message: z.string().trim().min(10).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: m } = await s
      .from("candidate_matches")
      .select("id,organization_id,position_id,application_id,candidate_profile_id,candidate_profiles(user_id)")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("not_found");

    await s
      .from("candidate_matches")
      .update({ integrity_status: "manual_review" })
      .eq("id", data.match_id);

    await audit({
      actor: context.userId,
      action: "information_requested",
      match_id: data.match_id,
      organization_id: m.organization_id,
      after: { message: data.message },
    });

    let notified = false;
    const candidateUser = (m.candidate_profiles as AnyRow)?.user_id ?? null;
    if (candidateUser) {
      try {
        const { emitEventFromServer } = await import("./notifications.functions");
        await emitEventFromServer({
          event: "clarification_requested",
          scope: `review:${data.match_id}:${Date.now()}`,
          candidate_match_id: data.match_id,
          candidate_profile_id: m.candidate_profile_id,
          organization_id: m.organization_id,
          actor_user_id: context.userId,
          payload: { message: data.message },
          recipients: [
            {
              user_id: candidateUser,
              audience: "candidate",
              link_path: `/me/applications/${m.application_id ?? ""}`,
            },
          ],
        } as never);
        notified = true;
      } catch {
        notified = false;
      }
    }
    return { ok: true as const, notified };
  });

// ─── Human overrides that reach the client (Prompt 10) ───────────────────────

const verdictInput = z.object({
  match_id: z.string().uuid(),
  reason: z.string().trim().min(8).max(1000),
  verdicts: z
    .array(
      z.object({
        requirement_id: z.string().min(1).max(200),
        verdict: z.enum(["met", "not_met", "not_applicable"]),
        reason: z.string().trim().min(8).max(1000),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * Record reviewer verdicts on requirements. Produces a NEW score run flagged
 * `evaluation_method = 'human_adjusted'` with the overriding user and reason
 * recorded — a completed run is never mutated.
 */
export const submitHumanAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => verdictInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const { createHumanAdjustedRun } = await import("./scoring/human-adjusted-run.server");
    return createHumanAdjustedRun({
      matchId: data.match_id,
      verdicts: data.verdicts,
      reason: data.reason,
      actorUserId: context.userId,
    });
  });

/** Machine-derived vs human-verified criteria for the current run. */
export const getHumanVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId);
    const s = await getAdmin();
    const { data: run } = await s
      .from("score_runs")
      .select("id,evaluation_method,result,final_score,score,fit_label,completed_at")
      .eq("candidate_match_id", data.match_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!run) return null;
    const { summariseRunVerification } = await import("./scoring/human-adjusted-run.server");
    return { run_id: run.id, ...summariseRunVerification(run) };
  });
