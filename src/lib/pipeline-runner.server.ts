// Automatic CV pipeline runner. Server-only.
// Progresses a candidate_match through:
//   parse → hydrate → enrich → score
// Every step is idempotent, records a processing_jobs row, and updates
// candidate_matches.processing_state so the Admin dashboard reflects
// progress without any drawer being opened.

import { extractCvText } from "./cv-extractor.server";
import { hydrateProfileFromCv } from "./cv-hydration.server";
import {
  ENGINE_VERSION,
  scoreCandidate,
  type RequirementInput,
  type ScreeningAnswer,
} from "./scoring-engine.server";
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

function buildRequirements(pos: Any): RequirementInput[] {
  const req = Array.isArray(pos?.requirements) ? (pos.requirements as string[]) : [];
  const pref = Array.isArray(pos?.preferred_requirements) ? (pos.preferred_requirements as string[]) : [];
  return [
    ...req.map((t, i) => ({ id: `req-${i}`, text: String(t), required: true, keywords: [] })),
    ...pref.map((t, i) => ({ id: `pref-${i}`, text: String(t), required: false, keywords: [] })),
  ];
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
    .select("id,application_id,candidate_profile_id,position_id,organization_id,processing_state,current_score_run_id")
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

// Advisory-lock via updating a sentinel: skip if already terminal state and no override.
// (Same match can be retried; caller uses `force`.)
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

    // ─── PARSE ────────────────────────────────────────────────────────────────
    if (!ctx.file) {
      await setState(s, matchId, "failed", { trace_id, code: "cv_unreadable", message: "No CV on file." });
      await recordJob(s, matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: "No CV on file." });
      return { match_id: matchId, trace_id, final_state: "failed", steps: [{ step: "parse", ok: false, note: "no_cv" }] };
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
    const reqs = buildRequirements(pos);
    if (reqs.length === 0) {
      await setState(s, matchId, "manual_review_required", {
        trace_id, code: "requirements_missing",
        message: "Position has no structured requirements to score against.",
      });
      return { match_id: matchId, trace_id, final_state: "manual_review_required", steps };
    }
    await setState(s, matchId, "ready_to_score", { trace_id });
    steps.push({ step: "enrich", ok: true });

    // ─── SCORE ────────────────────────────────────────────────────────────────
    await setState(s, matchId, "scoring", { trace_id });
    let result;
    try {
      result = scoreCandidate({ cv_text: cvText, requirements: reqs, screening });
    } catch (e) {
      const msg = (e as Error).message;
      await setState(s, matchId, "failed", { trace_id, code: "engine_error", message: msg });
      await recordJob(s, matchId, "score", "failed", trace_id, { code: "engine_error", message: msg });
      return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "score", ok: false, note: msg }] };
    }

    const { data: dup } = await s.from("score_runs")
      .select("id").eq("candidate_match_id", matchId)
      .eq("input_hash", result.input_hash).eq("status", "completed")
      .limit(1).maybeSingle();

    let runId: string;
    if (dup?.id) runId = dup.id;
    else {
      const { data: run, error: runErr } = await s.from("score_runs").insert({
        candidate_match_id: matchId,
        position_id: ctx.match.position_id,
        engine_version: ENGINE_VERSION,
        score: result.score,
        confidence: result.overall_confidence,
        status: "completed",
        explanation: [
          `${result.fit_label.replace(/_/g, " ")} • must-have coverage ${(result.must_have_coverage * 100).toFixed(0)}%`,
          result.strengths[0] ?? null, result.concerns[0] ?? null,
        ].filter(Boolean).join(" — "),
        evidence: result.evidence as unknown as Json,
        requirement_coverage: {
          must_have: result.category_breakdown.must_have,
          preferred: result.category_breakdown.preferred,
          screening_alignment: result.category_breakdown.screening_alignment,
        } as unknown as Json,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        trace_id,
        result: result as unknown as Json,
        fit_label: result.fit_label,
        must_have_coverage: result.must_have_coverage,
        preferred_coverage: result.preferred_coverage,
        contradiction_status: result.contradiction_status,
        input_hash: result.input_hash,
      }).select("id").single();
      if (runErr || !run) {
        const msg = runErr?.message ?? "insert_failed";
        await setState(s, matchId, "failed", { trace_id, code: "engine_error", message: msg });
        await recordJob(s, matchId, "score", "failed", trace_id, { code: "engine_error", message: msg });
        return { match_id: matchId, trace_id, final_state: "failed", steps: [...steps, { step: "score", ok: false, note: msg }] };
      }
      runId = run.id;
    }

    await s.from("candidate_matches").update({ current_score_run_id: runId }).eq("id", matchId);
    finalState =
      result.contradiction_status === "disqualifying_answer" || result.overall_confidence < 0.35
        ? "manual_review_required" : "scored";
    await setState(s, matchId, finalState, { trace_id });
    await recordJob(s, matchId, "score", "completed", trace_id);
    steps.push({ step: "score", ok: true, note: `${result.score.toFixed(1)}` });

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
