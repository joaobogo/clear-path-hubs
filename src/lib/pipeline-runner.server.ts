// Automatic CV pipeline runner. Server-only.
// Progresses a candidate_match through:
//   parse → hydrate → enrich → score
// Every step is idempotent, records a processing_jobs row, and updates
// candidate_matches.processing_state so the Admin dashboard reflects
// progress without any drawer being opened.

import { extractCvText } from "./cv-extractor.server";
import { hydrateProfileFromCv } from "./cv-hydration.server";
import { ENGINE_VERSION, type ScreeningAnswer } from "./scoring-engine.server";
import { executeScoring } from "./scoring-service.server";
import type { Json } from "@/integrations/supabase/types";

type State =
  | "queued" | "parsing" | "ocr_required" | "parsed" | "enriching"
  | "ready_to_score" | "scoring" | "scored" | "manual_review_required"
  | "provider_blocked" | "failed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function newTraceId() {
  return `pl_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Any;
}

async function setState(
  s: Any, matchId: string, state: State,
  opts: { trace_id?: string; code?: string | null; message?: string | null } = {},
) {
  await s.from("candidate_matches").update({
    processing_state: state,
    last_processing_trace_id: opts.trace_id ?? null,
    processing_error_code: opts.code ?? null,
    processing_error_message: opts.message ?? null,
  }).eq("id", matchId);
}

async function recordJob(
  s: Any, matchId: string, jobType: string,
  status: "completed" | "failed", trace_id: string,
  err?: { code: string; message: string },
  attempt = 1,
) {
  await s.from("processing_jobs").insert({
    entity_type: "candidate_match",
    entity_id: matchId,
    job_type: jobType,
    status,
    attempts: attempt,
    error_code: err?.code ?? null,
    error_message: err?.message ?? null,
    trace_id,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

// Requirements are built inside the canonical scoring service now.
// This helper only remains to detect "no structured requirements" for the enrich gate.
function hasStructuredRequirements(pos: Any): boolean {
  const req = Array.isArray(pos?.requirements) ? pos.requirements : [];
  const pref = Array.isArray(pos?.preferred_requirements) ? pos.preferred_requirements : [];
  return req.length + pref.length > 0;
}

function buildScreening(rows: Any[]): ScreeningAnswer[] {
  return rows.map((r) => {
    const q = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
    const value =
      r.answer && typeof r.answer === "object" && "value" in r.answer
        ? (r.answer as { value: unknown }).value
        : r.answer;
    return {
      question_id: r.question_id,
      question: q?.question ?? "",
      required: q?.required ?? false,
      answer_type: q?.answer_type ?? "text",
      value,
      disqualifying_condition: null,
    };
  });
}

export type PipelineOutcome = {
  match_id: string;
  trace_id: string;
  final_state: State;
  steps: Array<{ step: string; ok: boolean; note?: string }>;
};

async function loadCtx(s: Any, matchId: string) {
  const { data: match } = await s
    .from("candidate_matches")
    .select("id,application_id,candidate_profile_id,position_id,organization_id,processing_state,processing_updated_at,current_score_run_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) throw new Error(`match_not_found:${matchId}`);
  const [posRes, profRes, ansRes] = await Promise.all([
    s.from("positions").select("id,status,requirements,preferred_requirements,title").eq("id", match.position_id).maybeSingle(),
    s.from("candidate_profiles").select("id,current_cv_file_id,skills,experience,consent").eq("id", match.candidate_profile_id).maybeSingle(),
    s.from("application_answers").select("question_id,answer,screening_questions(question,answer_type,required,dealbreaker,preferred_answer)").eq("application_id", match.application_id),
  ]);
  const file = profRes.data?.current_cv_file_id
    ? (await s.from("files")
        .select("id,storage_bucket,storage_path,mime_type,filename,extracted_text,ocr_used,extraction_attempts")
        .eq("id", profRes.data.current_cv_file_id).maybeSingle()).data
    : null;
  return { match, position: posRes.data, profile: profRes.data, file, answers: (ansRes.data ?? []) as Any[] };
}

const TRANSIENT_STATES = new Set(["parsing", "enriching", "scoring"]);
const MAX_ATTEMPTS = 3;

async function countRecentFailures(s: Any, matchId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await s
    .from("processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "candidate_match")
    .eq("entity_id", matchId)
    .eq("status", "failed")
    .gte("started_at", since);
  return count ?? 0;
}

// Advisory-lock via checking transient state age: if another runner claimed
// this match <90s ago, skip to prevent duplicate concurrent work (retry storms).
export async function runPipelineForMatch(matchId: string, opts: { force?: boolean } = {}): Promise<PipelineOutcome> {
  const s = await getAdmin();
  const trace_id = newTraceId();
  const steps: PipelineOutcome["steps"] = [];
  let finalState: State = "queued";

  try {
    const ctx = await loadCtx(s, matchId);
    if (!opts.force && (ctx.match.processing_state === "scored" || ctx.match.processing_state === "manual_review_required")) {
      return { match_id: matchId, trace_id, final_state: ctx.match.processing_state as State, steps: [{ step: "skip", ok: true, note: "already_terminal" }] };
    }
    // Duplicate-trigger guard: another worker holds this match.
    if (!opts.force && TRANSIENT_STATES.has(ctx.match.processing_state)) {
      const ageMs = ctx.match.processing_updated_at
        ? Date.now() - new Date(ctx.match.processing_updated_at).getTime()
        : Infinity;
      if (ageMs < 90_000) {
        return { match_id: matchId, trace_id, final_state: ctx.match.processing_state as State, steps: [{ step: "skip", ok: true, note: `locked_${Math.round(ageMs / 1000)}s` }] };
      }
    }
    // Retry-storm guard: too many recent failures → mark permanent, need admin.
    if (!opts.force) {
      const fails = await countRecentFailures(s, matchId);
      if (fails >= MAX_ATTEMPTS) {
        await setState(s, matchId, "manual_review_required", {
          trace_id, code: "max_attempts_exceeded",
          message: `Auto-processing failed ${fails} times in 24h — admin review required.`,
        });
        return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [{ step: "skip", ok: false, note: `max_attempts:${fails}` }] };
      }
    }

    // ─── PARSE ────────────────────────────────────────────────────────────────
    if (!ctx.file) {
      await setState(s, matchId, "manual_review_required", { trace_id, code: "missing_usable_cv", message: "No CV on file — manual review required." });
      await recordJob(s, matchId, "parse", "failed", trace_id, { code: "missing_usable_cv", message: "no_cv" });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [{ step: "parse", ok: false, note: "no_cv" }] };
    }

    await setState(s, matchId, "parsing", { trace_id });
    let cvText = ctx.file.extracted_text ?? "";
    if (!cvText || cvText.length < 200) {
      const dl = await s.storage.from(ctx.file.storage_bucket).download(ctx.file.storage_path);
      if (dl.error || !dl.data) {
        const msg = dl.error?.message ?? "download_failed";
        await setState(s, matchId, "failed", { trace_id, code: "cv_unreadable", message: msg });
        await recordJob(s, matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: msg });
        return { match_id: matchId, trace_id, final_state: "failed", steps: [{ step: "parse", ok: false, note: msg }] };
      }
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const ext = await extractCvText(bytes, ctx.file.mime_type ?? "", ctx.file.filename ?? "");
      await s.from("files").update({
        extracted_text: ext.text,
        extraction_completed_at: new Date().toISOString(),
        extraction_attempts: (ctx.file.extraction_attempts ?? 0) + 1,
      }).eq("id", ctx.file.id);
      cvText = ext.text;

      if (ext.needs_ocr) {
        await setState(s, matchId, "ocr_required", {
          trace_id, code: "cv_unreadable",
          message: ext.reason ?? "Text layer missing — OCR needed.",
        });
        await recordJob(s, matchId, "parse", "completed", trace_id);
        return { match_id: matchId, trace_id, final_state: "ocr_required", steps: [{ step: "parse", ok: true, note: "ocr_required" }] };
      }
      if (!cvText || cvText.length < 60) {
        await setState(s, matchId, "failed", {
          trace_id, code: "cv_unreadable",
          message: ext.reason ?? `Unable to extract text (${ext.extractor}).`,
        });
        await recordJob(s, matchId, "parse", "failed", trace_id, {
          code: "cv_unreadable", message: ext.reason ?? "extract_empty",
        });
        return { match_id: matchId, trace_id, final_state: "failed", steps: [{ step: "parse", ok: false, note: ext.reason }] };
      }
    }
    await setState(s, matchId, "parsed", { trace_id });
    await recordJob(s, matchId, "parse", "completed", trace_id);
    steps.push({ step: "parse", ok: true, note: `${cvText.length} chars` });

    // ─── HYDRATE ──────────────────────────────────────────────────────────────
    await setState(s, matchId, "enriching", { trace_id });
    const hydration = await hydrateProfileFromCv({
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_text: cvText,
      trace_id,
      source_surface: "auto_pipeline",
    });
    await recordJob(
      s, matchId, "hydrate",
      hydration.ok ? "completed" : "failed", trace_id,
      hydration.ok ? undefined : { code: "hydration_failed", message: hydration.reason ?? "unknown" },
    );
    steps.push({
      step: "hydrate",
      ok: hydration.ok,
      note: hydration.ok ? `applied:${hydration.applied.length}` : hydration.reason,
    });

    // ─── EVIDENCE + ENRICH STATE ──────────────────────────────────────────────
    // Reload profile to snapshot post-hydration state.
    const { data: freshProfile } = await s
      .from("candidate_profiles")
      .select("id,skills,experience,headline,location,consent")
      .eq("id", ctx.match.candidate_profile_id)
      .maybeSingle();
    const screening = buildScreening(ctx.answers);
    await s.from("candidate_evidence").upsert({
      candidate_match_id: matchId,
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_file_id: ctx.file.id ?? null,
      engine_version: ENGINE_VERSION,
      extracted: {
        cv_length: cvText.length,
        skills: (freshProfile?.skills ?? []) as Json,
        experience: (freshProfile?.experience ?? []) as Json,
        headline: freshProfile?.headline ?? null,
        location: freshProfile?.location ?? null,
        hydration: { applied: hydration.applied, skipped: hydration.skipped, ok: hydration.ok, reason: hydration.reason ?? null },
      } as unknown as Json,
      screening_normalized: {
        answers: screening.map((s2) => ({
          question_id: s2.question_id, question: s2.question,
          value: s2.value as Json, answer_type: s2.answer_type, required: s2.required,
        })),
      } as unknown as Json,
      raw_text_sample: cvText.slice(0, 800),
    }, { onConflict: "candidate_match_id,engine_version" });

    const pos = ctx.position;
    if (!pos || pos.status !== "active") {
      await setState(s, matchId, "manual_review_required", {
        trace_id, code: "position_inactive",
        message: `Position is ${pos?.status ?? "missing"} — manual review required.`,
      });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps };
    }
    if (!hasStructuredRequirements(pos)) {
      await setState(s, matchId, "manual_review_required", {
        trace_id, code: "requirements_missing",
        message: "Position has no structured requirements to score against.",
      });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps };
    }
    await setState(s, matchId, "ready_to_score", { trace_id });
    steps.push({ step: "enrich", ok: true });

    // ─── SCORE (delegated to canonical service) ──────────────────────────────
    const scoring = await executeScoring(matchId, {
      trace_id, reason: "auto_pipeline",
    });
    if (!scoring.ok) {
      // service already recorded processing_jobs + state; just surface here.
      return {
        match_id: matchId, trace_id,
        final_state: scoring.final_state,
        steps: [...steps, { step: "score", ok: false, note: scoring.code }],
      };
    }
    finalState = scoring.final_state;
    steps.push({ step: "score", ok: true, note: scoring.reused ? "reused" : `${scoring.score.toFixed(1)}` });

    return { match_id: matchId, trace_id, final_state: finalState, steps };
  } catch (err) {
    const msg = (err as Error).message ?? "pipeline_error";
    try {
      await setState(s, matchId, "failed", { trace_id, code: "engine_error", message: msg });
      await recordJob(s, matchId, "pipeline", "failed", trace_id, { code: "engine_error", message: msg });
    } catch { /* swallow */ }
    return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "pipeline", ok: false, note: msg }] };
  }
}

// ─── Narrow re-runnable steps (used by Admin drawer actions) ─────────────────

/**
 * Re-run hydration + evidence snapshot for a single match without re-parsing
 * the CV. Respects locked_fields / admin_corrected / user_confirmed via
 * hydrateProfileFromCv. Ends in ready_to_score (or manual_review_required if
 * requirements/position gates fail).
 */
export async function runHydrationOnly(matchId: string): Promise<PipelineOutcome> {
  const s = await getAdmin();
  const trace_id = newTraceId();
  const steps: PipelineOutcome["steps"] = [];
  try {
    const ctx = await loadCtx(s, matchId);
    if (!ctx.file) {
      await setState(s, matchId, "manual_review_required", { trace_id, code: "missing_usable_cv", message: "No CV on file — manual review required." });
      await recordJob(s, matchId, "hydrate", "failed", trace_id, { code: "missing_usable_cv", message: "no_cv" });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [{ step: "hydrate", ok: false, note: "no_cv" }] };
    }
    const cvText = ctx.file.extracted_text ?? "";
    if (!cvText || cvText.length < 60) {
      await setState(s, matchId, "failed", { trace_id, code: "cv_unreadable", message: "CV text not yet extracted — run Retry Parse first." });
      await recordJob(s, matchId, "hydrate", "failed", trace_id, { code: "cv_unreadable", message: "no_text" });
      return { match_id: matchId, trace_id, final_state: "failed", steps: [{ step: "hydrate", ok: false, note: "no_text" }] };
    }
    await setState(s, matchId, "enriching", { trace_id });
    const hydration = await hydrateProfileFromCv({
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_text: cvText,
      trace_id,
      source_surface: "admin_retry_hydration",
    });
    await recordJob(
      s, matchId, "hydrate",
      hydration.ok ? "completed" : "failed", trace_id,
      hydration.ok ? undefined : { code: "hydration_failed", message: hydration.reason ?? "unknown" },
    );
    steps.push({ step: "hydrate", ok: hydration.ok, note: hydration.ok ? `applied:${hydration.applied.length}` : hydration.reason });
    // Refresh evidence + advance readiness.
    return await runEnrichmentOnly(matchId, { trace_id, previousSteps: steps });
  } catch (err) {
    const msg = (err as Error).message ?? "hydrate_error";
    await setState(s, matchId, "failed", { trace_id, code: "engine_error", message: msg }).catch(() => undefined);
    await recordJob(s, matchId, "hydrate", "failed", trace_id, { code: "engine_error", message: msg }).catch(() => undefined);
    return { match_id: matchId, trace_id, final_state: "failed", steps: [{ step: "hydrate", ok: false, note: msg }] };
  }
}

/**
 * Refresh evidence graph from the current profile + CV without invoking the
 * LLM. Marks match as ready_to_score (or manual_review_required if gates fail).
 */
export async function runEnrichmentOnly(
  matchId: string,
  opts: { trace_id?: string; previousSteps?: PipelineOutcome["steps"] } = {},
): Promise<PipelineOutcome> {
  const s = await getAdmin();
  const trace_id = opts.trace_id ?? newTraceId();
  const steps: PipelineOutcome["steps"] = [...(opts.previousSteps ?? [])];
  try {
    const ctx = await loadCtx(s, matchId);
    if (!ctx.file) {
      await setState(s, matchId, "failed", { trace_id, code: "cv_unreadable", message: "No CV on file." });
      await recordJob(s, matchId, "enrich", "failed", trace_id, { code: "cv_unreadable", message: "no_cv" });
      return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "enrich", ok: false, note: "no_cv" }] };
    }
    const cvText = ctx.file.extracted_text ?? "";
    if (!cvText) {
      await setState(s, matchId, "failed", { trace_id, code: "cv_unreadable", message: "No extracted CV text." });
      await recordJob(s, matchId, "enrich", "failed", trace_id, { code: "cv_unreadable", message: "no_text" });
      return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "enrich", ok: false, note: "no_text" }] };
    }
    const { data: freshProfile } = await s
      .from("candidate_profiles")
      .select("id,skills,experience,headline,location,consent")
      .eq("id", ctx.match.candidate_profile_id).maybeSingle();
    const screening = buildScreening(ctx.answers);
    await s.from("candidate_evidence").upsert({
      candidate_match_id: matchId,
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_file_id: ctx.file.id ?? null,
      engine_version: ENGINE_VERSION,
      extracted: {
        cv_length: cvText.length,
        skills: (freshProfile?.skills ?? []) as Json,
        experience: (freshProfile?.experience ?? []) as Json,
        headline: freshProfile?.headline ?? null,
        location: freshProfile?.location ?? null,
        refreshed_at: new Date().toISOString(),
      } as unknown as Json,
      screening_normalized: {
        answers: screening.map((s2) => ({
          question_id: s2.question_id, question: s2.question,
          value: s2.value as Json, answer_type: s2.answer_type, required: s2.required,
        })),
      } as unknown as Json,
      raw_text_sample: cvText.slice(0, 800),
    }, { onConflict: "candidate_match_id,engine_version" });
    await recordJob(s, matchId, "enrich", "completed", trace_id);
    const pos = ctx.position;
    if (!pos || pos.status !== "active") {
      await setState(s, matchId, "manual_review_required", { trace_id, code: "position_inactive", message: `Position is ${pos?.status ?? "missing"} — manual review required.` });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [...steps, { step: "enrich", ok: true }] };
    }
    if (!hasStructuredRequirements(pos)) {
      await setState(s, matchId, "manual_review_required", { trace_id, code: "requirements_missing", message: "Position has no structured requirements to score against." });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [...steps, { step: "enrich", ok: true }] };
    }
    await setState(s, matchId, "ready_to_score", { trace_id });
    return { match_id: matchId, trace_id, final_state: "ready_to_score", steps: [...steps, { step: "enrich", ok: true }] };
  } catch (err) {
    const msg = (err as Error).message ?? "enrich_error";
    await setState(s, matchId, "failed", { trace_id, code: "engine_error", message: msg }).catch(() => undefined);
    await recordJob(s, matchId, "enrich", "failed", trace_id, { code: "engine_error", message: msg }).catch(() => undefined);
    return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "enrich", ok: false, note: msg }] };
  }
}

/**
 * Force a match into manual_review_required. Records an audit-visible job row
 * with the supplied reason. Does not touch scoring or profile fields.
 */
export async function forceManualReview(matchId: string, reason: string): Promise<PipelineOutcome> {
  const s = await getAdmin();
  const trace_id = newTraceId();
  await setState(s, matchId, "manual_review_required", { trace_id, code: "admin_manual_review", message: reason });
  await recordJob(s, matchId, "manual_review", "completed", trace_id);
  return { match_id: matchId, trace_id, final_state: "manual_review_required", steps: [{ step: "manual_review", ok: true, note: reason.slice(0, 80) }] };
}

// Drain queued/stuck matches. Used by cron + fire-and-forget.
export async function drainQueue(opts: { limit?: number } = {}): Promise<{ processed: number; results: PipelineOutcome[] }> {
  const s = await getAdmin();
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 25);
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: rows } = await s.from("candidate_matches")
    .select("id,processing_state,updated_at")
    .in("processing_state", ["queued", "parsing", "enriching", "scoring", "ready_to_score", "parsed"])
    .or(`processing_state.eq.queued,updated_at.lt.${staleBefore}`)
    .order("updated_at", { ascending: true })
    .limit(limit);
  const results: PipelineOutcome[] = [];
  for (const r of (rows ?? []) as Any[]) {
    // Force through stuck non-queued rows.
    results.push(await runPipelineForMatch(r.id, { force: r.processing_state !== "queued" }));
  }
  return { processed: results.length, results };
}

