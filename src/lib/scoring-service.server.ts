// Canonical scoring service. SERVER-ONLY.
//
// This is the ONLY entry point that may:
//   • read a candidate_match's evidence/context,
//   • invoke the scoring engine,
//   • insert a `score_runs` row,
//   • advance `candidate_matches.current_score_run_id` / `processing_state`.
//
// Anything else (pipeline runner, manual retry, admin drawer buttons, cron)
// MUST call `executeScoring(matchId, ...)` here. Direct writes to score_runs
// or fit_score/current_score_run_id from other code paths are forbidden.
//
// Guarantees per successful run:
//   • exact identity — score_run.candidate_match_id == matchId
//                      score_run.position_id == candidate_matches.position_id
//                      (DB trigger `score_runs_identity` also enforces this)
//   • readiness gate — precise blockers returned instead of "scoring failed"
//   • immutability   — completed runs are never mutated; rescore = new row
//                      (DB trigger `score_runs_immutable` also enforces this)
//   • reconciliation — category_breakdown x weights reproduce raw_score, and
//                      raw_score + applied caps reproduce final_score
//   • calibration    — every engine constant comes from a versioned calibration
//                      (scoring/engine-calibration.ts), stamped on the run
//   • provenance     — trace_id, blueprint_version, engine_version stamped

import {
  ENGINE_VERSION,
  combineCategories,
  scoreCandidate,
  type RequirementInput,
  type ScreeningAnswer,
  type ScoringResult,
} from "./scoring-engine.server";
import {
  EVALUATION_METHOD,
  parseCalibration,
  resolveCalibration,
  serialiseCalibration,
  type EngineCalibration,
} from "./scoring/engine-calibration";
import { buildReplaySnapshot } from "./scoring/replay";
import type { Json } from "@/integrations/supabase/types";

export const SCORING_BLUEPRINT_VERSION = "taasflow-blueprint-v1.0.0";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type ScoringBlockerCode =
  | "match_not_found"
  | "candidate_profile_not_found"
  | "position_not_found"
  | "tenant_mismatch"
  | "requirements_missing"
  | "position_status:archived"
  | "position_status:closed"
  | "cv_missing"
  | "cv_file_missing"
  | "cv_unparsed"
  | "evidence_missing"
  | "concurrent_scoring_lock";

export type ExecuteScoringOutcome =
  | { ok: true; run_id: string; match_id: string; trace_id: string; final_state: "scored" | "manual_review_required"; reused: boolean; score: number }
  | { ok: false; match_id: string; trace_id: string; final_state: "failed" | "manual_review_required"; blockers: string[]; code: string; message: string };

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Any;
}

export function newScoringTraceId() {
  return `sc_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** Public: check whether a match is ready to score. Returns precise blockers. */
export async function checkScoringReadiness(matchId: string) {
  const s = await getAdmin();
  const { data, error } = await s.rpc("scoring_readiness", { _match_id: matchId });
  if (error) throw new Error(`readiness_rpc:${error.message}`);
  return data as {
    ok: boolean;
    blockers: string[];
    match_id: string;
    application_id: string;
    candidate_profile_id: string;
    position_id: string;
    organization_id: string;
    processing_state: string;
    screening_answer_count: number;
  };
}

/** Build engine inputs strictly from the match's own position + application. */
async function loadInputs(matchId: string) {
  const s = await getAdmin();
  const { data: match } = await s
    .from("candidate_matches")
    .select("id,application_id,candidate_profile_id,position_id,organization_id,processing_state,current_score_run_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) throw new Error("match_not_found");

  const [posRes, profRes, ansRes] = await Promise.all([
    s.from("positions")
      .select("id,status,requirements,preferred_requirements,title,organization_id")
      .eq("id", match.position_id).maybeSingle(),
    s.from("candidate_profiles")
      .select("id,current_cv_file_id")
      .eq("id", match.candidate_profile_id).maybeSingle(),
    s.from("application_answers")
      .select("question_id,answer,screening_questions(question,answer_type,required,dealbreaker,preferred_answer)")
      .eq("application_id", match.application_id),
  ]);

  const cvFile = profRes.data?.current_cv_file_id
    ? (await s.from("files")
        .select("id,extracted_text,storage_bucket,storage_path,mime_type,filename")
        .eq("id", profRes.data.current_cv_file_id).maybeSingle()).data
    : null;

  const reqToText = (r: unknown): string | null => {
    if (typeof r === "string") return r.trim() || null;
    if (r && typeof r === "object") {
      const o = r as { label?: unknown; text?: unknown; name?: unknown; requirement?: unknown };
      const v = o.label ?? o.text ?? o.name ?? o.requirement;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return null;
  };
  const mapReqs = (arr: unknown, prefix: string, required: boolean): RequirementInput[] => {
    if (!Array.isArray(arr)) return [];
    const out: RequirementInput[] = [];
    arr.forEach((t, i) => {
      const text = reqToText(t);
      if (text) out.push({ id: `${prefix}-${i}`, text, required, keywords: [] });
    });
    return out;
  };
  const requirements: RequirementInput[] = [
    ...mapReqs(posRes.data?.requirements, "req", true),
    ...mapReqs(posRes.data?.preferred_requirements, "pref", false),
  ];

  const screening: ScreeningAnswer[] = (ansRes.data ?? []).map((r: Any) => {
    const q = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
    const value = r.answer && typeof r.answer === "object" && "value" in r.answer
      ? (r.answer as { value: unknown }).value
      : r.answer;
    let disq: ScreeningAnswer["disqualifying_condition"] = null;
    if (q?.dealbreaker && q?.answer_type === "boolean") disq = { operator: "equals", value: false };
    return {
      question_id: r.question_id,
      question: q?.question ?? "",
      required: q?.required ?? false,
      answer_type: q?.answer_type ?? "text",
      value,
      disqualifying_condition: disq,
    };
  });

  return { match, position: posRes.data, profile: profRes.data, cvFile, requirements, screening };
}

/**
 * Reconcile the stored triple. The engine now reports raw_score and the caps it
 * applied, so this proves three separate things instead of restating one
 * (audit finding 11):
 *   1. category_breakdown x category_weights reproduces raw_score,
 *   2. applying the recorded caps to raw_score reproduces the final score,
 *   3. raw_score >= final_score, with a cap present whenever they differ.
 */
function reconcile(result: ScoringResult): {
  reconciled: boolean;
  raw: number;
  computed: number;
  applied_cap: number | null;
  applied_caps: Array<{ reason: string; cap: number; before: number }>;
  mismatch?: string;
} {
  // Use the run's own weights so absent categories stay excluded.
  const raw01 = combineCategories(result.category_breakdown, result.category_weights);
  const raw = Math.round(raw01 * 1000) / 10;
  const applied_caps = result.applied_caps ?? [];
  let capped01 = raw01;
  for (const cap of applied_caps) capped01 = Math.min(capped01, cap.cap);
  const computed = Math.round(capped01 * 1000) / 10;
  // The lowest cap in force, expressed on the 0-100 scale. Null when the score
  // was never clamped — an honest "no cap applied" rather than a mirror value.
  const applied_cap = applied_caps.length
    ? Math.round(Math.min(...applied_caps.map((c) => c.cap)) * 1000) / 10
    : null;

  const mismatches: string[] = [];
  if (Math.abs(raw - result.raw_score) >= 0.15) {
    mismatches.push(`raw:computed=${raw} declared=${result.raw_score}`);
  }
  if (Math.abs(computed - result.score) >= 0.15) {
    mismatches.push(`final:computed=${computed} declared=${result.score}`);
  }
  if (result.raw_score < result.score - 0.15) {
    mismatches.push(`raw_below_final:${result.raw_score}<${result.score}`);
  }
  if (Math.abs(result.raw_score - result.score) >= 0.15 && applied_caps.length === 0) {
    mismatches.push("uncapped_drop_without_reason");
  }
  return {
    reconciled: mismatches.length === 0,
    raw,
    computed,
    applied_cap,
    applied_caps,
    mismatch: mismatches.join("; ") || undefined,
  };
}

/**
 * The rubric version that governs this position. Every run must name one, so
 * when a position has no governing version yet we mint one from its current
 * requirements and stamp it approved — a score with no criteria list behind it
 * is unauditable (audit finding 1).
 */
async function ensureRubricVersion(
  s: Any,
  position: {
    id: string;
    organization_id: string;
    title?: string | null;
    requirements?: unknown;
    preferred_requirements?: unknown;
  },
  /** Calibration written onto a NEWLY minted version. Existing versions keep theirs. */
  defaultCalibration: EngineCalibration,
): Promise<{ id: string; calibration: EngineCalibration }> {
  const { data: existing } = await s
    .from("rubric_versions")
    .select("id,version_number,status,calibration")
    .eq("position_id", position.id)
    .in("status", ["approved", "active"])
    .is("superseded_at", null)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    // A published rubric version is immutable, so its stored calibration — not
    // today's defaults — governs every run that names it.
    return { id: existing.id as string, calibration: parseCalibration(existing.calibration) };
  }

  const { data: latest } = await s
    .from("rubric_versions")
    .select("version_number")
    .eq("position_id", position.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = Number(latest?.version_number ?? 0) + 1;

  const requirements = Array.isArray(position.requirements) ? position.requirements : [];
  const preferred = Array.isArray(position.preferred_requirements)
    ? position.preferred_requirements
    : [];

  const { data: created, error } = await s
    .from("rubric_versions")
    .insert({
      position_id: position.id,
      organization_id: position.organization_id,
      version_number: nextVersion,
      status: "approved",
      label: `auto-v${nextVersion}`,
      dimensions: requirements,
      weights: {},
      anchors: {},
      qualifiers: preferred,
      calibration: serialiseCalibration(defaultCalibration),
      engine_version: defaultCalibration.engine_version,
      snapshot: {
        origin: "auto-from-position-requirements",
        position_title: position.title ?? null,
        requirements,
        preferred_requirements: preferred,
        captured_at: new Date().toISOString(),
      },
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    // Losing the race against a concurrent run is fine — re-read.
    const { data: retry } = await s
      .from("rubric_versions")
      .select("id,calibration")
      .eq("position_id", position.id)
      .in("status", ["approved", "active"])
      .is("superseded_at", null)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (retry?.id) {
      return { id: retry.id as string, calibration: parseCalibration(retry.calibration) };
    }
    throw new Error(`rubric_version_unavailable:${error?.message ?? "insert_failed"}`);
  }
  return { id: created.id as string, calibration: defaultCalibration };
}



/**
 * Role family for calibration lookup. Uses the same SQL classifier the rest of
 * the platform uses so the family recorded on a run matches reporting.
 */
async function resolveRoleFamily(s: Any, title: string | null): Promise<string | null> {
  if (!title) return null;
  try {
    const { data, error } = await s.rpc("role_family_of", { _title: title });
    if (error) return null;
    return typeof data === "string" && data.trim() ? data.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

async function acquireLock(s: Any, matchId: string, trace_id: string): Promise<boolean> {
  // Atomic "acquire" — transition the state to `scoring` only if not already there.
  // Prevents two concurrent scoring runs on the same match.
  const { data, error } = await s
    .from("candidate_matches")
    .update({ processing_state: "scoring", last_processing_trace_id: trace_id })
    .eq("id", matchId)
    .neq("processing_state", "scoring")
    .select("id")
    .maybeSingle();
  return !error && !!data?.id;
}

async function releaseLock(s: Any, matchId: string, nextState: string, trace_id: string, err?: { code: string; message: string }) {
  await s.from("candidate_matches").update({
    processing_state: nextState,
    last_processing_trace_id: trace_id,
    processing_error_code: err?.code ?? null,
    processing_error_message: err?.message ?? null,
  }).eq("id", matchId);
}

async function recordJob(
  s: Any, matchId: string, status: "completed" | "failed", trace_id: string,
  attempt: number, err?: { code: string; message: string },
) {
  await s.from("processing_jobs").insert({
    entity_type: "candidate_match",
    entity_id: matchId,
    job_type: "score",
    status,
    attempts: attempt,
    error_code: err?.code ?? null,
    error_message: err?.message ?? null,
    trace_id,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

/**
 * Canonical scoring entry point.
 *
 * @param matchId the specific candidate_match to score (identity = matchId).
 * @param opts.force  ignore the "already-terminal" short-circuit.
 * @param opts.reason human/system reason recorded on the trace.
 * @param opts.actor_user_id logged in processing_jobs when triggered by staff.
 */
export async function executeScoring(
  matchId: string,
  opts: { force?: boolean; reason?: string; actor_user_id?: string | null; trace_id?: string } = {},
): Promise<ExecuteScoringOutcome> {
  const s = await getAdmin();
  const trace_id = opts.trace_id ?? newScoringTraceId();

  // 1) Readiness — one round-trip, precise blockers.
  const readiness = await checkScoringReadiness(matchId);
  if (!readiness.ok) {
    await releaseLock(s, matchId, "manual_review_required", trace_id, {
      code: "readiness_blocked",
      message: readiness.blockers.join(","),
    });
    await recordJob(s, matchId, "failed", trace_id, 1, {
      code: "readiness_blocked", message: readiness.blockers.join(","),
    });
    return {
      ok: false, match_id: matchId, trace_id,
      final_state: "manual_review_required",
      blockers: readiness.blockers,
      code: "readiness_blocked",
      message: `Blocked: ${readiness.blockers.join(", ")}`,
    };
  }

  // 2) Idempotency short-circuit.
  const { data: current } = await s
    .from("candidate_matches")
    .select("processing_state,current_score_run_id,position_id")
    .eq("id", matchId).maybeSingle();
  if (!opts.force && current?.processing_state === "scored" && current.current_score_run_id) {
    return {
      ok: true, run_id: current.current_score_run_id, match_id: matchId, trace_id,
      final_state: "scored", reused: true, score: -1,
    };
  }

  // 3) Concurrency lock.
  const locked = await acquireLock(s, matchId, trace_id);
  if (!locked) {
    return {
      ok: false, match_id: matchId, trace_id,
      final_state: "manual_review_required",
      blockers: ["concurrent_scoring_lock"],
      code: "concurrent_scoring_lock",
      message: "Another scoring run is already in progress for this match.",
    };
  }

  try {
    // 4) Load inputs strictly from the match's own IDs.
    const ctx = await loadInputs(matchId);
    if (!ctx.position || !ctx.cvFile) {
      throw new Error(!ctx.position ? "position_not_found" : "cv_file_missing");
    }
    if (ctx.position.organization_id !== ctx.match.organization_id) {
      throw new Error("tenant_mismatch");
    }
    if (ctx.requirements.length === 0) throw new Error("requirements_missing");

    const cvText: string = ctx.cvFile.extracted_text ?? "";
    if (cvText.length < 60) throw new Error("cv_unparsed");

    // 5) Resolve the governing rubric version FIRST: it owns the calibration,
    //    so every constant behind the number is stored alongside the criteria
    //    and a run replays from its rubric version plus its inputs. Role-family
    //    defaults only apply when a brand-new version is minted here.
    const roleFamily = await resolveRoleFamily(s, ctx.position.title ?? null);
    const rubric = await ensureRubricVersion(
      s,
      {
        id: ctx.match.position_id,
        organization_id: ctx.match.organization_id,
        title: ctx.position.title ?? null,
        requirements: (ctx.position as Any).requirements,
        preferred_requirements: (ctx.position as Any).preferred_requirements,
      },
      resolveCalibration(roleFamily),
    );
    const rubricVersionId = rubric.id;
    const calibration = rubric.calibration;

    // 6) Score with the rubric's own calibration.
    const raw = scoreCandidate({
      cv_text: cvText,
      requirements: ctx.requirements,
      screening: ctx.screening,
      calibration,
    });

    // 7) Reconcile caps.
    const rec = reconcile(raw);
    if (!rec.reconciled) {
      throw new Error(`reconciliation_failed:${rec.mismatch}`);
    }

    // 8) Reuse: identical inputs AND the same governing rubric version means the
    //    answer cannot differ, so we point at the existing run instead of
    //    inserting a duplicate.
    const { data: dup } = await s.from("score_runs")
      .select("id,score,fit_label")
      .eq("candidate_match_id", matchId)
      .eq("input_hash", raw.input_hash)
      .eq("rubric_version_id", rubricVersionId)
      .eq("status", "completed")
      .is("superseded_at", null)
      // Earliest wins, so the reused run stays stable across repeat calls.
      .order("completed_at", { ascending: true })
      .limit(1).maybeSingle();

    let runId: string;
    let reused = false;
    if (dup?.id && !opts.force) {
      runId = dup.id;
      reused = true;
    } else {
      const explanation = buildExplanation(raw, rec.applied_caps);
      const enrichedResult = {
        ...raw,
        blueprint_version: SCORING_BLUEPRINT_VERSION,
        rubric_version_id: rubricVersionId,
        calibration_version: calibration.calibration_version,
        calibration: serialiseCalibration(calibration),
        role_family: roleFamily,
        // Inputs are stored verbatim so `replayScoreRun` can recompute this
        // exact score from the run alone. Runs are staff-only by RLS.
        inputs: buildReplaySnapshot({
          cv_text: cvText,
          requirements: ctx.requirements,
          screening: ctx.screening,
          role_family: roleFamily,
        }),
        evaluation_method: EVALUATION_METHOD,
        applied_caps: rec.applied_caps,
        reconciliation: {
          raw_computed: rec.raw,
          raw_declared: raw.raw_score,
          final_computed: rec.computed,
          final_declared: raw.score,
          applied_cap: rec.applied_cap,
          ok: true,
        },
        actor_user_id: opts.actor_user_id ?? null,
        reason: opts.reason ?? null,
        identity: {
          match_id: matchId,
          position_id: ctx.match.position_id,
          candidate_profile_id: ctx.match.candidate_profile_id,
          application_id: ctx.match.application_id,
          organization_id: ctx.match.organization_id,
        },
      };
      const { data: run, error: runErr } = await s.from("score_runs").insert({
        candidate_match_id: matchId,
        position_id: ctx.match.position_id, // enforced by trigger
        // ── Scoring Identity Contract (first-class columns) ────────────────
        application_id: ctx.match.application_id,
        candidate_profile_id: ctx.match.candidate_profile_id,
        candidate_submission_id: ctx.match.application_id,
        organization_id: ctx.match.organization_id,
        blueprint_version: SCORING_BLUEPRINT_VERSION,
        rubric_version_id: rubricVersionId,
        // ── Math (raw / cap / final) ───────────────────────────────────────
        // Three distinct facts: pre-cap composite, the cap in force (null when
        // none), and the published number.
        raw_score: raw.raw_score,
        applied_cap: rec.applied_cap,
        final_score: raw.score,
        evaluation_method: EVALUATION_METHOD,
        fit_band: raw.fit_label,
        // ── Legacy mirror columns kept for existing readers ────────────────
        engine_version: ENGINE_VERSION,
        score: raw.score,
        // Two distinct facts, both persisted: how confident the run is overall,
        // and how much of the rubric its evidence could actually decide.
        confidence: raw.overall_confidence,
        evidence_confidence: raw.evidence_confidence,
        status: "completed",
        explanation,
        evidence: raw.evidence as unknown as Json,
        requirement_coverage: {
          must_have: raw.category_breakdown.must_have,
          preferred: raw.category_breakdown.preferred,
          screening_alignment: raw.category_breakdown.screening_alignment,
          category_weights: raw.category_weights,
          requirement_assessment: raw.requirement_assessment,
        } as unknown as Json,

        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        trace_id,
        result: enrichedResult as unknown as Json,
        fit_label: raw.fit_label,
        must_have_coverage: raw.must_have_coverage,
        preferred_coverage: raw.preferred_coverage,
        contradiction_status: raw.contradiction_status,
        input_hash: raw.input_hash,
      }).select("id").single();

      if (runErr || !run) throw new Error(runErr?.message ?? "score_insert_failed");
      runId = run.id;
    }

    await s
      .from("candidate_matches")
      .update({
        current_score_run_id: runId,
        ...(reused ? {} : { evidence_confidence: raw.evidence_confidence }),
      })
      .eq("id", matchId);

    const finalState: "scored" | "manual_review_required" =
      raw.contradiction_status === "disqualifying_answer" ||
      raw.overall_confidence < calibration.manual_review_confidence
        ? "manual_review_required"
        : "scored";

    await releaseLock(s, matchId, finalState, trace_id);
    await recordJob(s, matchId, "completed", trace_id, 1);

    return {
      ok: true, run_id: runId, match_id: matchId, trace_id,
      final_state: finalState, reused, score: raw.score,
    };
  } catch (err) {
    const msg = (err as Error).message ?? "engine_error";
    await releaseLock(s, matchId, "failed", trace_id, { code: "engine_error", message: msg });
    await recordJob(s, matchId, "failed", trace_id, 1, { code: "engine_error", message: msg });
    return {
      ok: false, match_id: matchId, trace_id,
      final_state: "failed", blockers: [msg], code: "engine_error", message: msg,
    };
  }
}

function buildExplanation(r: ScoringResult, caps: Array<{ reason: string; cap: number }>): string {
  const parts = [
    `${r.fit_label.replace(/_/g, " ")} — score ${r.score.toFixed(1)}/100`,
    `must-have coverage ${(r.must_have_coverage * 100).toFixed(0)}%`,
    `preferred coverage ${(r.preferred_coverage * 100).toFixed(0)}%`,
  ];
  if (caps.length) parts.push(`caps: ${caps.map((c) => `${c.reason}→${(c.cap * 100).toFixed(0)}`).join(", ")}`);
  if (r.strengths[0]) parts.push(`+ ${r.strengths[0]}`);
  if (r.concerns[0]) parts.push(`− ${r.concerns[0]}`);
  return parts.join(" · ");
}

/** Publish gate. Called before flipping approved_score_run_id / client_visibility. */
export async function assertPublishGate(matchId: string, runId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = await getAdmin();
  const [{ data: match }, { data: run }] = await Promise.all([
    s.from("candidate_matches").select("id,position_id,organization_id").eq("id", matchId).maybeSingle(),
    s.from("score_runs").select("id,candidate_match_id,position_id,status,evidence,contradiction_status").eq("id", runId).maybeSingle(),
  ]);
  if (!match) return { ok: false, reason: "match_not_found" };
  if (!run) return { ok: false, reason: "run_not_found" };
  if (run.candidate_match_id !== match.id) return { ok: false, reason: "run_belongs_to_other_match" };
  if (run.position_id !== match.position_id) return { ok: false, reason: "run_position_mismatch" };
  if (run.status !== "completed") return { ok: false, reason: `run_status:${run.status}` };
  // Evidence array may be empty when extraction returned nothing structured;
  // admin is exercising manual judgement here, so we don't block on it.
  void run.evidence;
  if (run.contradiction_status === "disqualifying_answer") return { ok: false, reason: "disqualifying_contradiction" };
  return { ok: true };
}
