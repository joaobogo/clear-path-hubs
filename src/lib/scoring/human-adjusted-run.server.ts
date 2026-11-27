/**
 * Human overrides that reach the client (Prompt 10) — persistence.
 *
 * A reviewer's verdict on a requirement produces a NEW score run. A completed
 * run is never mutated (DB trigger `score_runs_immutable` also enforces this):
 * the adjusted run is inserted, stamped `evaluation_method = 'human_adjusted'`
 * with the overriding user and the mandatory reason recorded, and the match is
 * pointed at it. The machine run stays readable forever for comparison.
 *
 * Every verdict is also appended to `evidence_overrides` when a matching
 * evidence item exists, so the append-only override history stays the single
 * place to answer "who changed what, and why".
 */
import {
  applyHumanVerdicts,
  isDeliberateVerdict,
  isVerdict,
  latestVerdicts,
  planReapply,
  recomputeAdjustedScore,
  requirementTextKey,
  verifiedScoreShare,
  HUMAN_EVALUATION_METHOD,
  HUMAN_LEDGER_FORMAT,
  type AssessmentRow,
  type HumanRunLedger,
  type HumanVerdictInput,
  type HumanVerdictRecord,
  type ReapplyPlan,
  type StoredVerdict,
} from "./human-adjustment";
import {
  parseCalibration,
  resolveCalibration,
  serialiseCalibration,
  type EngineCalibration,
} from "./engine-calibration";
import {
  hasVideoIntro,
  publishedScore,
  scoreVoidedByUnreadableCv,
  videoBonusFor,
  withVideoIntroBonus,
} from "./published-score";
import { SCREENING_BY_RECRUITER_NOTE } from "../candidate/answer-source";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function getAdmin(): Promise<Any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Any;
}

async function actorName(s: Any, userId: string): Promise<string> {
  const { data } = await s
    .from("profiles")
    .select("full_name,email")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data?.full_name || data?.email || "A reviewer";
}

function calibrationFor(result: Any): EngineCalibration {
  try {
    if (result?.calibration) return parseCalibration(result.calibration);
  } catch {
    /* fall through to the role-family default */
  }
  return resolveCalibration(result?.role_family ?? null);
}

export type HumanAdjustmentOutcome = {
  ok: true;
  run_id: string;
  previous_run_id: string;
  raw_score: number;
  final_score: number;
  /**
   * The figure every surface publishes for the new run: final_score plus the
   * intro-video bonus when the match carries one (runs never store it).
   */
  published_score: number | null;
  /** Points the intro video adds to final_score (0 without a video). */
  video_bonus: number;
  applied_cap: number | null;
  cap_reason: string | null;
  fit_label: string;
  verified: ReturnType<typeof verifiedScoreShare>;
  applied: HumanVerdictRecord[];
  unknown_requirement_ids: string[];
};

const RUN_COLUMNS =
  "id,candidate_match_id,position_id,organization_id,rubric_version_id,blueprint_version,engine_version,score,raw_score,final_score,applied_cap,confidence,evidence_confidence,fit_label,must_have_coverage,preferred_coverage,contradiction_status,input_hash,evidence,requirement_coverage,explanation,result,completed_at,evaluation_method";

const MATCH_COLUMNS =
  "id,position_id,application_id,candidate_profile_id,organization_id,current_score_run_id,intro_video_url,processing_state,processing_error_code";

function assessmentOf(run: Any): AssessmentRow[] {
  const result = (run?.result ?? {}) as Any;
  return Array.isArray(result?.requirement_assessment)
    ? (result.requirement_assessment as AssessmentRow[])
    : Array.isArray((run?.requirement_coverage as Any)?.requirement_assessment)
      ? ((run.requirement_coverage as Any).requirement_assessment as AssessmentRow[])
      : [];
}

/**
 * The machine run a review sits on: the given run, or the latest completed run
 * the engine produced. A review is always applied to machine rows, never to
 * another review, so `machine_status` on every row is what the engine said.
 */
async function machineRunFor(s: Any, matchId: string, runId?: string | null): Promise<Any> {
  if (runId) {
    const { data } = await s.from("score_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle();
    return data ?? null;
  }
  const { data } = await s
    .from("score_runs")
    .select(RUN_COLUMNS)
    .eq("candidate_match_id", matchId)
    .eq("status", "completed")
    .or(`evaluation_method.is.null,evaluation_method.neq.${HUMAN_EVALUATION_METHOD}`)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Every human-adjusted run of a match, oldest first, as review history. */
async function humanHistory(s: Any, matchId: string): Promise<HumanRunLedger[]> {
  const { data, error } = await s
    .from("score_runs")
    .select("id,completed_at,result")
    .eq("candidate_match_id", matchId)
    .eq("status", "completed")
    .eq("evaluation_method", HUMAN_EVALUATION_METHOD)
    .order("completed_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message ?? "review_history_failed");
  return ((data ?? []) as Any[]).map((run) => {
    const adjustment = (run.result?.human_adjustment ?? {}) as Any;
    return {
      run_id: String(run.id),
      at: String(adjustment.at ?? run.completed_at ?? ""),
      format: typeof adjustment.format === "number" ? adjustment.format : null,
      verdicts: (Array.isArray(adjustment.verdicts) ? adjustment.verdicts : []).filter((v: Any) =>
        isVerdict(v?.verdict),
      ),
      carried_forward: (Array.isArray(adjustment.carried_forward)
        ? adjustment.carried_forward
        : []
      ).filter((v: Any) => isVerdict(v?.verdict)),
      assessment: assessmentOf(run),
    } satisfies HumanRunLedger;
  });
}

/**
 * The latest verdict a person gave on each requirement of a match, from the
 * match's human-adjusted runs (score_runs.result.human_adjustment).
 */
export async function latestVerdictsForMatch(matchId: string, db?: Any): Promise<StoredVerdict[]> {
  const s = db ?? (await getAdmin());
  return latestVerdicts(await humanHistory(s, matchId));
}

type ReviewRunInput = {
  s: Any;
  match: Any;
  /** The machine run the review sits on. */
  base: Any;
  plan: ReapplyPlan;
  /** The person recording a review now; null when the system re-applies one. */
  actor: { user_id: string; name: string } | null;
  reason: string;
  now: string;
  traceId?: string;
};

type ReviewRunBuilt = {
  adjusted: AssessmentRow[];
  applied: HumanVerdictRecord[];
  unknownIds: string[];
  adj: ReturnType<typeof recomputeAdjustedScore>;
  verified: ReturnType<typeof verifiedScoreShare>;
  screeningAlignment: number | null;
  calibration: EngineCalibration;
};

/** The reviewed rows and score for a plan on a machine run; nothing is written. */
function buildReviewRun(base: Any, plan: ReapplyPlan): ReviewRunBuilt {
  const result = (base.result ?? {}) as Any;
  const calibration = calibrationFor(result);
  const {
    assessment: adjusted,
    applied,
    unknownIds,
  } = applyHumanVerdicts(assessmentOf(base), plan.apply);
  const weights = (result?.category_weights ?? null) as Any;
  const screeningApplied = weights ? Number(weights.screening_alignment ?? 0) > 0 : false;
  const screeningAlignment = screeningApplied
    ? Number((result?.category_breakdown as Any)?.screening_alignment ?? 0)
    : null;
  const carriedCaps = (Array.isArray(result?.applied_caps) ? result.applied_caps : [])
    .filter((c: Any) => !String(c?.reason ?? "").startsWith("must_have_floor"))
    .map((c: Any) => ({ reason: String(c.reason), cap: Number(c.cap) }));
  const adj = recomputeAdjustedScore({
    assessment: adjusted,
    screeningAlignment,
    calibration,
    carriedCaps,
    unknownLabel: base.fit_label === "unknown",
  });
  return {
    adjusted,
    applied,
    unknownIds,
    adj,
    verified: verifiedScoreShare(adjusted, adj.category_weights),
    screeningAlignment,
    calibration,
  };
}

/**
 * What the machine run said about its inputs, carried onto the reviewed run:
 * the reviewed run is the one every surface reads, and a review of the
 * verdicts does not change whose screening answers were scored or which dates
 * a recruiter corrected.
 */
export function inputNotes(machineResult: Any): string[] {
  const notes: string[] = [];
  if (Number(machineResult?.screening_source?.recruiter_on_behalf ?? 0) > 0) {
    notes.push(SCREENING_BY_RECRUITER_NOTE);
  }
  const dates = machineResult?.profile_evidence?.note;
  if (typeof dates === "string" && dates.trim()) notes.push(dates.trim());
  return notes;
}

/** What a reviewed run says, row by row, to tell two runs apart. */
function reviewSignature(rows: readonly AssessmentRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.id}:${r.status}:${r.human_verified === true ? (r.human_verdict ?? "") : "-"}:${r.not_applicable === true ? "na" : ""}`,
    )
    .join("|");
}

/**
 * Insert the human-adjusted run for a plan, supersede the machine run under it
 * and point the match at the new run. A completed run is never edited.
 */
async function persistReviewRun(
  input: ReviewRunInput,
  built: ReviewRunBuilt,
): Promise<{ runId: string }> {
  const { s, match, base, plan, actor, now } = input;
  const { adjusted, applied, unknownIds, adj, verified, screeningAlignment, calibration } = built;
  const result = (base.result ?? {}) as Any;

  // Who made the calls: the person recording now, or, when the system puts a
  // review back, the person who made the most recent call. Never the system.
  const lastCall = [...applied, ...plan.carried_forward].sort((a, b) =>
    String(b.at).localeCompare(String(a.at)),
  )[0];
  const adjustment = {
    format: HUMAN_LEDGER_FORMAT,
    derived_from_run_id: base.id,
    actor_user_id: actor?.user_id ?? lastCall?.actor_user_id ?? null,
    actor_name: actor?.name ?? lastCall?.actor_name ?? "A reviewer",
    reason: input.reason.trim(),
    at: actor ? now : (lastCall?.at ?? now),
    reapplied: actor === null,
    ...(actor === null ? { reapplied_at: now } : {}),
    verdicts: applied,
    carried_forward: plan.carried_forward,
    dropped: plan.dropped,
    unknown_requirement_ids: unknownIds,
  };

  const enrichedResult = {
    ...result,
    requirement_assessment: adjusted,
    category_weights: adj.category_weights,
    category_breakdown: {
      must_have: adj.must_have_coverage,
      preferred: adj.preferred_coverage,
      screening_alignment: screeningAlignment ?? 0,
    },
    calibration: serialiseCalibration(calibration),
    calibration_version: calibration.calibration_version,
    evaluation_method: HUMAN_EVALUATION_METHOD,
    applied_caps: adj.applied_caps,
    raw_score: adj.raw_score,
    score: adj.final_score,
    fit_label: adj.fit_label,
    must_have_coverage: adj.must_have_coverage,
    preferred_coverage: adj.preferred_coverage,
    // Provenance of the human step: who, when, why, and what changed.
    human_adjustment: adjustment,
    verified_evidence: verified,
    reconciliation: {
      raw_computed: adj.raw_score,
      raw_declared: adj.raw_score,
      final_computed: adj.final_score,
      final_declared: adj.final_score,
      applied_cap: adj.applied_cap,
      cap_reasons: adj.applied_caps.map((c) => c.reason),
      ok: true,
    },
  };

  const explanation = [
    `${adj.fit_label.replace(/_/g, " ")} — score ${adj.final_score.toFixed(1)}/100 after human review`,
    `must-have coverage ${(adj.must_have_coverage * 100).toFixed(0)}%`,
    `${verified.human_verified} of ${verified.total} criteria human-verified`,
    ...(adj.cap_reason ? [`caps: ${adj.cap_reason}`] : []),
    ...inputNotes(result),
  ].join(" · ");

  // A human-adjusted run has the same machine inputs but a different verdict
  // set, so it must not collide with `score_runs_active_input_key` (one active
  // completed run per identical match+input+rubric). Stamp a derived hash.
  const runId = crypto.randomUUID();
  const humanInputHash = `${base.input_hash ?? "none"}+human:${runId.slice(0, 8)}`;

  const { data: run, error: insErr } = await s
    .from("score_runs")
    .insert({
      id: runId,
      candidate_match_id: match.id,
      position_id: match.position_id,
      application_id: match.application_id,
      candidate_profile_id: match.candidate_profile_id,
      candidate_submission_id: match.application_id,
      organization_id: match.organization_id,
      blueprint_version: base.blueprint_version,
      rubric_version_id: base.rubric_version_id,
      raw_score: adj.raw_score,
      applied_cap: adj.applied_cap,
      cap_reason: adj.cap_reason,
      final_score: adj.final_score,
      // The one column that says a person, not the engine, set this number.
      evaluation_method: HUMAN_EVALUATION_METHOD,
      fit_band: adj.fit_label,
      engine_version: base.engine_version,
      score: adj.final_score,
      confidence: base.confidence,
      evidence_confidence: base.evidence_confidence,
      // Written as running, completed below: only one completed run per match
      // may be active (score_runs_one_current_per_submission), so the run it
      // replaces is superseded first.
      status: "running",
      explanation,
      evidence: base.evidence,
      requirement_coverage: {
        must_have: adj.must_have_coverage,
        preferred: adj.preferred_coverage,
        screening_alignment: screeningAlignment ?? 0,
        category_weights: adj.category_weights,
        requirement_assessment: adjusted,
      },
      started_at: now,
      completed_at: null,
      trace_id: input.traceId ?? `human-adj-${String(match.id).slice(0, 8)}-${Date.now()}`,
      result: enrichedResult,
      fit_label: adj.fit_label,
      must_have_coverage: adj.must_have_coverage,
      preferred_coverage: adj.preferred_coverage,
      contradiction_status: base.contradiction_status,
      input_hash: humanInputHash,
    })
    .select("id")
    .single();
  if (insErr || !run) throw new Error(insErr?.message ?? "human_adjusted_insert_failed");

  // The machine run, and any earlier reviewed run, stay readable but are no
  // longer active; then this run completes and the match points at it. If any
  // step fails the new run is marked failed and nothing points at it.
  try {
    const { error: supErr } = await s
      .from("score_runs")
      .update({
        superseded_at: now,
        superseded_by_run_id: run.id,
        superseded_reason: "human_adjusted",
      })
      .eq("candidate_match_id", match.id)
      .eq("status", "completed")
      .is("superseded_at", null);
    if (supErr) throw new Error(supErr.message ?? "supersede_failed");

    const { error: doneErr } = await s
      .from("score_runs")
      .update({ status: "completed", completed_at: now })
      .eq("id", run.id);
    if (doneErr) throw new Error(doneErr.message ?? "complete_failed");

    const { error: pointErr } = await s
      .from("candidate_matches")
      .update({ current_score_run_id: run.id })
      .eq("id", match.id);
    if (pointErr) throw new Error(pointErr.message ?? "current_run_update_failed");
  } catch (e) {
    await s
      .from("score_runs")
      .update({ status: "failed", error_code: "human_adjusted_incomplete" })
      .eq("id", run.id)
      .eq("status", "running");
    throw e;
  }

  return { runId: run.id as string };
}

/**
 * Record reviewer verdicts and publish the resulting human-adjusted run.
 *
 * The review is rebuilt on the latest machine run: the calls already on record
 * for the match, with today's verdicts replacing any on the same requirement.
 */
export async function createHumanAdjustedRun(opts: {
  matchId: string;
  verdicts: readonly HumanVerdictInput[];
  actorUserId: string;
  /** Reason covering the adjustment as a whole (per-verdict reasons are kept too). */
  reason: string;
  traceId?: string;
}): Promise<HumanAdjustmentOutcome> {
  const s = await getAdmin();

  const { data: match } = await s
    .from("candidate_matches")
    .select(MATCH_COLUMNS)
    .eq("id", opts.matchId)
    .maybeSingle();
  if (!match) throw new Error("match_not_found");

  const base = await machineRunFor(s, opts.matchId);
  if (!base) throw new Error("no_completed_run");
  const assessment = assessmentOf(base);
  if (assessment.length === 0) throw new Error("no_requirement_assessment");

  const name = await actorName(s, opts.actorUserId);
  const now = new Date().toISOString();

  // Today's calls, each against what the machine says right now.
  const fresh: StoredVerdict[] = [];
  for (const v of opts.verdicts) {
    const row = assessment.find((a) => a.id === v.requirement_id);
    if (!row) continue;
    const machineStatus = (row.machine_status as string | null) ?? (row.status as string) ?? null;
    fresh.push({
      requirement_id: v.requirement_id,
      verdict: v.verdict,
      reason: v.reason.trim(),
      actor_user_id: opts.actorUserId,
      actor_name: name,
      at: now,
      machine_status: machineStatus,
      requirement_text: (row.text as string | undefined) ?? null,
      decided_machine_status: machineStatus,
      deliberate: isDeliberateVerdict(v.verdict, machineStatus),
    });
  }
  if (fresh.length === 0) throw new Error("no_matching_requirements");

  // Earlier calls stay, except where today's verdict is on the same requirement.
  const freshKeys = new Set(
    fresh.map((v) => requirementTextKey(v.requirement_text) || v.requirement_id),
  );
  const earlier = (await latestVerdictsForMatch(opts.matchId, s))
    .filter((v) => !freshKeys.has(requirementTextKey(v.requirement_text) || v.requirement_id))
    .map((v) => ({ ...v, reapplied: true }));

  // A call made today that agrees with the machine is still shown on its row
  // (planReapply applies a confirmation while the machine says the same).
  const plan = planReapply(assessment, [...earlier, ...fresh]);
  const todayIds = new Set(fresh.map((v) => v.requirement_id));

  const built = buildReviewRun(base, plan);
  if (built.applied.length === 0) throw new Error("no_matching_requirements");
  const { runId } = await persistReviewRun(
    {
      s,
      match,
      base,
      plan,
      actor: { user_id: opts.actorUserId, name },
      reason: opts.reason,
      now,
      traceId: opts.traceId,
    },
    built,
  );
  const { adj, verified, unknownIds } = built;
  const applied = built.applied.filter((v) => todayIds.has(v.requirement_id));

  // Append-only override history, and mark the matching evidence item as
  // reviewed. The machine `result` on the item is never rewritten here.
  const { data: items } = await s
    .from("candidate_evidence_items")
    .select("id,rubric_criterion_key,result,organization_id")
    .eq("candidate_match_id", opts.matchId);
  for (const v of applied) {
    const item = (items ?? []).find(
      (i: Any) => String(i.rubric_criterion_key ?? "") === v.requirement_id,
    );
    await s.from("evidence_overrides").insert({
      evidence_item_id: item?.id ?? null,
      candidate_match_id: opts.matchId,
      organization_id: match.organization_id,
      actor_user_id: opts.actorUserId,
      reason: v.reason,
      before_state: {
        requirement_id: v.requirement_id,
        machine_status: v.machine_status,
        score_run_id: base.id,
      },
      after_state: {
        requirement_id: v.requirement_id,
        human_verdict: v.verdict,
        actor_name: name,
        score_run_id: runId,
      },
    });
    if (item?.id) {
      await s
        .from("candidate_evidence_items")
        .update({
          reviewer_status: "edited",
          reviewer_note: v.reason,
          reviewed_by: opts.actorUserId,
          reviewed_at: now,
          last_reviewed_at: now,
        })
        .eq("id", item.id);
    }
  }

  await s.from("audit_events").insert({
    actor_user_id: opts.actorUserId,
    action: "score_human_adjusted",
    entity_type: "candidate_match",
    entity_id: opts.matchId,
    organization_id: match.organization_id,
    before_state: {
      run_id: base.id,
      final_score: base.final_score ?? base.score,
      fit_label: base.fit_label,
      evaluation_method: (base.result as Any)?.evaluation_method ?? null,
    },
    after_state: {
      run_id: runId,
      final_score: adj.final_score,
      fit_label: adj.fit_label,
      evaluation_method: HUMAN_EVALUATION_METHOD,
      reason: opts.reason.trim(),
      verdicts: applied.map((v) => ({
        requirement_id: v.requirement_id,
        verdict: v.verdict,
        machine_status: v.machine_status,
      })),
      kept_from_earlier_reviews: built.applied.length - applied.length,
      verified_share: verified.weighted_share,
    },
  });

  return {
    ok: true,
    run_id: runId,
    previous_run_id: base.id,
    raw_score: adj.raw_score,
    final_score: adj.final_score,
    published_score: scoreVoidedByUnreadableCv(match)
      ? null
      : publishedScore(
          withVideoIntroBonus(
            { score: adj.final_score, final_score: adj.final_score },
            hasVideoIntro(match),
          ),
        ),
    video_bonus:
      hasVideoIntro(match) && !scoreVoidedByUnreadableCv(match)
        ? videoBonusFor(adj.final_score)
        : 0,
    applied_cap: adj.applied_cap,
    cap_reason: adj.cap_reason,
    fit_label: adj.fit_label,
    verified,
    applied,
    unknown_requirement_ids: unknownIds,
  };
}

export type ReapplyOutcome =
  /** No review on record: the machine run stands. */
  | { status: "none" }
  /** The current reviewed run already says exactly this, on this machine run. */
  | { status: "unchanged"; run_id: string; final_score: number }
  /** A new reviewed run was written on the machine run and is now current. */
  | {
      status: "reapplied";
      run_id: string;
      final_score: number;
      kept: number;
      followed_machine: number;
    };

/**
 * Put the recruiter's review back on a machine run.
 *
 * Called in the same job as every machine score (executeScoring), before the
 * match is pointed anywhere: a match with a review on record goes from one
 * reviewed run straight to the next, and no surface shows the bare machine
 * score in between. Writes nothing when there is no review, or when the
 * current reviewed run already sits on this machine run and says the same.
 * Throws on failure; the caller keeps the previous reviewed run current.
 */
/**
 * What putting the review back on a machine result would give, without
 * writing anything. Used by the re-score preview: the same plan and the same
 * arithmetic as reapplyHumanReview, on a result that was never stored.
 */
export async function previewReviewOnResult(opts: {
  matchId: string;
  /** The machine result as a run would store it. */
  result: Any;
  fitLabel: string | null;
  db?: Any;
}): Promise<
  | { reviewed: false }
  | {
      reviewed: true;
      final_score: number;
      assessment: AssessmentRow[];
      kept: number;
      followed_machine: number;
      dropped: number;
    }
> {
  const s = opts.db ?? (await getAdmin());
  const stored = await latestVerdictsForMatch(opts.matchId, s);
  if (stored.length === 0) return { reviewed: false };
  const base = { result: opts.result, fit_label: opts.fitLabel };
  const assessment = assessmentOf(base);
  if (assessment.length === 0) return { reviewed: false };
  const plan = planReapply(
    assessment,
    stored.map((v) => ({ ...v, reapplied: true })),
  );
  if (plan.apply.length === 0 && plan.carried_forward.length === 0) return { reviewed: false };
  const built = buildReviewRun(base, plan);
  return {
    reviewed: true,
    final_score: built.adj.final_score,
    assessment: built.adjusted,
    kept: plan.apply.length,
    followed_machine: plan.carried_forward.length,
    dropped: plan.dropped.length,
  };
}

export async function reapplyHumanReview(opts: {
  matchId: string;
  /** The machine run just completed; defaults to the latest one. */
  machineRunId?: string | null;
  traceId?: string;
  db?: Any;
}): Promise<ReapplyOutcome> {
  const s = opts.db ?? (await getAdmin());
  const stored = await latestVerdictsForMatch(opts.matchId, s);
  if (stored.length === 0) return { status: "none" };

  const base = await machineRunFor(s, opts.matchId, opts.machineRunId);
  if (!base) throw new Error("no_completed_run");
  if (base.evaluation_method === HUMAN_EVALUATION_METHOD)
    throw new Error("base_is_not_a_machine_run");
  const assessment = assessmentOf(base);
  if (assessment.length === 0) throw new Error("no_requirement_assessment");

  const plan = planReapply(
    assessment,
    stored.map((v) => ({ ...v, reapplied: true })),
  );
  // Every call belongs to a requirement the role no longer has: nothing to keep.
  if (plan.apply.length === 0 && plan.carried_forward.length === 0) return { status: "none" };
  const built = buildReviewRun(base, plan);

  const { data: match } = await s
    .from("candidate_matches")
    .select(MATCH_COLUMNS)
    .eq("id", opts.matchId)
    .maybeSingle();
  if (!match) throw new Error("match_not_found");

  if (match.current_score_run_id) {
    const { data: current } = await s
      .from("score_runs")
      .select("id,evaluation_method,final_score,result")
      .eq("id", match.current_score_run_id)
      .maybeSingle();
    if (
      current?.evaluation_method === HUMAN_EVALUATION_METHOD &&
      (current.result as Any)?.human_adjustment?.derived_from_run_id === base.id &&
      Number(current.final_score) === built.adj.final_score &&
      reviewSignature(assessmentOf(current)) === reviewSignature(built.adjusted)
    ) {
      return {
        status: "unchanged",
        run_id: current.id as string,
        final_score: built.adj.final_score,
      };
    }
  }

  const now = new Date().toISOString();
  const { runId } = await persistReviewRun(
    {
      s,
      match,
      base,
      plan,
      actor: null,
      reason: "Recruiter review kept after a machine re-score",
      now,
      traceId: opts.traceId,
    },
    built,
  );

  await s.from("audit_events").insert({
    // The system put the review back; the people who made the calls are on
    // each verdict. No person is recorded as having acted here.
    actor_user_id: null,
    action: "score_review_reapplied",
    entity_type: "candidate_match",
    entity_id: opts.matchId,
    organization_id: match.organization_id,
    before_state: {
      run_id: match.current_score_run_id ?? null,
      machine_run_id: base.id,
      machine_score: base.final_score ?? base.score,
    },
    after_state: {
      run_id: runId,
      final_score: built.adj.final_score,
      fit_label: built.adj.fit_label,
      evaluation_method: HUMAN_EVALUATION_METHOD,
      kept: built.applied.map((v) => ({
        requirement_id: v.requirement_id,
        verdict: v.verdict,
        machine_status: v.machine_status,
        decided_by: v.actor_name,
        decided_at: v.at,
      })),
      followed_machine: plan.carried_forward.map((v) => ({
        requirement_id: v.requirement_id,
        was: v.verdict,
        machine_status: v.machine_status,
      })),
      dropped: plan.dropped,
    },
    trace_id: opts.traceId ?? null,
  });

  return {
    status: "reapplied",
    run_id: runId,
    final_score: built.adj.final_score,
    kept: built.applied.length,
    followed_machine: plan.carried_forward.length,
  };
}

/**
 * Read-side summary for staff surfaces: which criteria are machine-derived,
 * which are human-verified, and how much of the score rests on verification.
 */
export function summariseRunVerification(run: Any): {
  humanAdjusted: boolean;
  actorName: string | null;
  at: string | null;
  reason: string | null;
  rows: Array<{
    id: string;
    text: string;
    required: boolean;
    status: string;
    source: "machine" | "human";
    machine_status: string | null;
    verdict: string | null;
    reason: string | null;
    actor_name: string | null;
    not_applicable: boolean;
    /** The machine's result changed after the person decided, and still differs. */
    machine_changed: boolean;
    /** What the machine said when the person decided. */
    decided_machine_status: string | null;
    /** The verdict was put back by the system after a machine re-score. */
    reapplied: boolean;
  }>;
  verified: ReturnType<typeof verifiedScoreShare>;
} {
  const result = (run?.result ?? {}) as Any;
  const assessment: AssessmentRow[] = Array.isArray(result?.requirement_assessment)
    ? result.requirement_assessment
    : [];
  const weights = (result?.category_weights ?? {
    must_have: 1,
    preferred: 0,
    screening_alignment: 0,
  }) as Any;
  const adjustment = result?.human_adjustment ?? null;
  return {
    humanAdjusted: run?.evaluation_method === HUMAN_EVALUATION_METHOD,
    actorName: adjustment?.actor_name ?? null,
    at: adjustment?.at ?? null,
    reason: adjustment?.reason ?? null,
    rows: assessment.map((a) => ({
      id: String(a.id),
      text: String(a.text ?? a.id),
      required: a.required !== false,
      status: String(a.status ?? "unknown"),
      source: a.human_verified === true ? "human" : "machine",
      machine_status: (a.machine_status as string | null) ?? null,
      verdict: (a.human_verdict as string | null) ?? null,
      reason: (a.human_reason as string | null) ?? null,
      actor_name: (a.human_actor_name as string | null) ?? null,
      not_applicable: a.not_applicable === true,
      machine_changed: a.human_verified === true && a.machine_changed_since_review === true,
      decided_machine_status: (a.human_decided_machine_status as string | null) ?? null,
      reapplied: a.human_reapplied === true,
    })),
    verified: verifiedScoreShare(assessment, {
      must_have: Number(weights.must_have ?? 1),
      preferred: Number(weights.preferred ?? 0),
      screening_alignment: Number(weights.screening_alignment ?? 0),
    }),
  };
}
