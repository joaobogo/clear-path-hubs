// Processing pipeline for candidate matches.
// State machine:
//   queued → parsing → (ocr_required) → parsed → enriching →
//   ready_to_score → scoring → scored | manual_review_required
// Terminal error branches: provider_blocked, failed.
//
// Every advance step is:
//   - idempotent (safe to call twice for the same match)
//   - scoped to a single match / application / position tuple
//   - recorded with a trace id and processing_job row
//   - never rewrites completed score runs (they are immutable)

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import {
  ENGINE_VERSION,
  type RequirementInput,
  type ScreeningAnswer,
} from "@/lib/scoring-engine.server";
import { executeScoring, assertPublishGate } from "@/lib/scoring-service.server";
import { ADMIN_REJECTION_REASONS } from "@/lib/client-decision-reasons";

type State =
  | "queued"
  | "parsing"
  | "ocr_required"
  | "parsed"
  | "enriching"
  | "ready_to_score"
  | "scoring"
  | "scored"
  | "manual_review_required"
  | "provider_blocked"
  | "failed";

type ProcessingCode =
  | "ok"
  | "cv_unreadable"
  | "missing_usable_cv"
  | "requirements_missing"
  | "provider_error"
  | "position_inactive"
  | "engine_error";

function traceId() {
  return `pr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// Naive extractor: pulls printable text from raw bytes, strips XML.
// Real deployments swap this for a proper PDF parser; the interface is stable.
async function extractText(
  bytes: Uint8Array,
  mime: string,
): Promise<{ text: string; needs_ocr: boolean }> {
  const td = new TextDecoder("utf-8", { fatal: false });
  const decoded = td.decode(bytes);
  const printable = decoded
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripped = printable
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = stripped.length > printable.length * 0.3 ? stripped : printable;
  const looksLikePdf =
    mime.includes("pdf") || (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50);
  const needs_ocr = text.length < 200 && looksLikePdf;
  return { text, needs_ocr };
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function loadMatchContext(matchId: string) {
  const supabase = (await getAdmin()) as AnyRow;
  const { data: match, error } = await supabase
    .from("candidate_matches")
    .select(
      "id,application_id,candidate_profile_id,position_id,organization_id,processing_state,current_score_run_id,approved_score_run_id",
    )
    .eq("id", matchId)
    .maybeSingle();
  if (error || !match) throw new Error(`match_not_found:${matchId}`);

  const { data: position } = await supabase
    .from("positions")
    .select("id,title,status,description,requirements,preferred_requirements")
    .eq("id", match.position_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("id,full_name,email,current_cv_file_id,skills,experience")
    .eq("id", match.candidate_profile_id)
    .maybeSingle();

  const file = profile?.current_cv_file_id
    ? (
        await supabase
          .from("files")
          .select(
            "id,storage_bucket,storage_path,mime_type,extracted_text,ocr_used,extraction_attempts",
          )
          .eq("id", profile.current_cv_file_id)
          .maybeSingle()
      ).data
    : null;

  const { data: answers } = await supabase
    .from("application_answers")
    .select(
      "question_id,answer,screening_questions(question,answer_type,required,dealbreaker,preferred_answer)",
    )
    .eq("application_id", match.application_id);

  return { match, position, profile, file, answers: (answers ?? []) as AnyRow[] };
}

async function setState(
  matchId: string,
  state: State,
  opts: { trace_id?: string; code?: string | null; message?: string | null } = {},
) {
  const supabase = (await getAdmin()) as AnyRow;
  await supabase
    .from("candidate_matches")
    .update({
      processing_state: state,
      last_processing_trace_id: opts.trace_id ?? null,
      processing_error_code: opts.code ?? null,
      processing_error_message: opts.message ?? null,
    })
    .eq("id", matchId);
}

async function recordJob(
  matchId: string,
  jobType: string,
  status: "completed" | "failed",
  trace_id: string,
  err?: { code: ProcessingCode; message: string },
) {
  const supabase = (await getAdmin()) as AnyRow;
  await supabase.from("processing_jobs").insert({
    entity_type: "candidate_match",
    entity_id: matchId,
    job_type: jobType,
    status,
    attempts: 1,
    error_code: err?.code ?? null,
    error_message: err?.message ?? null,
    trace_id,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });
}

function buildRequirements(pos: {
  requirements: unknown;
  preferred_requirements: unknown;
}): RequirementInput[] {
  const req = Array.isArray(pos.requirements) ? (pos.requirements as string[]) : [];
  const pref = Array.isArray(pos.preferred_requirements)
    ? (pos.preferred_requirements as string[])
    : [];
  return [
    ...req.map((t, i) => ({ id: `req-${i}`, text: String(t), required: true, keywords: [] })),
    ...pref.map((t, i) => ({ id: `pref-${i}`, text: String(t), required: false, keywords: [] })),
  ];
}

function buildScreening(rows: AnyRow[]): ScreeningAnswer[] {
  return rows.map((r) => {
    const q = Array.isArray(r.screening_questions)
      ? r.screening_questions[0]
      : r.screening_questions;
    // answers are stored as { value: X }
    const value =
      r.answer && typeof r.answer === "object" && "value" in r.answer
        ? (r.answer as { value: unknown }).value
        : r.answer;
    // Dealbreaker semantics: for boolean questions, wrong-side answer is disqualifying.
    // For non-boolean questions with a preferred_answer, mismatch is disqualifying.
    let disqualifying: ScreeningAnswer["disqualifying_condition"] = null;
    if (q?.dealbreaker) {
      if (q.answer_type === "boolean") {
        // Assume "yes" is the intended answer; if not, treat "no" as disqualifying.
        disqualifying = { operator: "equals", value: false };
      } else if (q.preferred_answer != null) {
        disqualifying = { operator: "equals", value: null }; // handled below via alignment
      }
    }
    return {
      question_id: r.question_id,
      question: q?.question ?? "",
      required: q?.required ?? false,
      answer_type: q?.answer_type ?? "text",
      value,
      disqualifying_condition: disqualifying,
    };
  });
}

// ---------- pipeline steps ----------

async function stepParse(matchId: string, trace_id: string): Promise<State> {
  const supabase = (await getAdmin()) as AnyRow;
  const ctx = await loadMatchContext(matchId);
  if (!ctx.file) {
    await setState(matchId, "manual_review_required", {
      trace_id,
      code: "missing_usable_cv",
      message: "No CV on file — manual review required.",
    });
    await recordJob(matchId, "parse", "failed", trace_id, {
      code: "missing_usable_cv",
      message: "no_cv",
    });
    return "manual_review_required";
  }

  await setState(matchId, "parsing", { trace_id });

  if (ctx.file.extracted_text && ctx.file.extracted_text.length >= 200) {
    await setState(matchId, "parsed", { trace_id });
    return "parsed";
  }

  const dl = await supabase.storage.from(ctx.file.storage_bucket).download(ctx.file.storage_path);
  if (dl.error || !dl.data) {
    const msg = dl.error?.message ?? "download_failed";
    await setState(matchId, "failed", { trace_id, code: "cv_unreadable", message: msg });
    await recordJob(matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: msg });
    return "failed";
  }
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const { text, needs_ocr } = await extractText(bytes, ctx.file.mime_type ?? "");

  await supabase
    .from("files")
    .update({
      extracted_text: text,
      extraction_completed_at: new Date().toISOString(),
      extraction_attempts: (ctx.file.extraction_attempts ?? 0) + 1,
    })
    .eq("id", ctx.file.id);

  if (needs_ocr) {
    await setState(matchId, "ocr_required", {
      trace_id,
      code: "cv_unreadable",
      message: "PDF text extraction yielded no usable content — OCR needed.",
    });
    return "ocr_required";
  }
  await setState(matchId, "parsed", { trace_id });
  return "parsed";
}

async function stepEnrich(matchId: string, trace_id: string): Promise<State> {
  const supabase = (await getAdmin()) as AnyRow;
  const ctx = await loadMatchContext(matchId);
  await setState(matchId, "enriching", { trace_id });

  const cvText: string = ctx.file?.extracted_text ?? "";
  const screening = buildScreening(ctx.answers);

  await supabase.from("candidate_evidence").upsert(
    {
      candidate_match_id: matchId,
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_file_id: ctx.file?.id ?? null,
      engine_version: ENGINE_VERSION,
      extracted: {
        cv_length: cvText.length,
        skills: (ctx.profile?.skills ?? []) as Json,
        experience: (ctx.profile?.experience ?? []) as Json,
      } as unknown as Json,
      screening_normalized: {
        answers: screening.map((s) => ({
          question_id: s.question_id,
          question: s.question,
          value: s.value as Json,
          answer_type: s.answer_type,
          required: s.required,
        })),
      } as unknown as Json,
      raw_text_sample: cvText.slice(0, 800),
    },
    { onConflict: "candidate_match_id,engine_version" },
  );

  const pos = ctx.position;
  if (!pos || pos.status !== "active") {
    await setState(matchId, "manual_review_required", {
      trace_id,
      code: "position_inactive",
      message: `Position is ${pos?.status ?? "missing"} — manual review required.`,
    });
    return "manual_review_required";
  }
  const reqs = buildRequirements(pos);
  if (reqs.length === 0) {
    await setState(matchId, "manual_review_required", {
      trace_id,
      code: "requirements_missing",
      message: "Position has no structured requirements to score against.",
    });
    return "manual_review_required";
  }

  await setState(matchId, "ready_to_score", { trace_id });
  return "ready_to_score";
}

async function stepScore(matchId: string, trace_id: string): Promise<State> {
  // Delegates to the canonical scoring service — do NOT insert score_runs here.
  const outcome = await executeScoring(matchId, { trace_id, reason: "manual_step" });
  return outcome.final_state;
}

async function isStaff(userId: string): Promise<boolean> {
  const supabase = (await getAdmin()) as AnyRow;
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  return !!data;
}

// ---------- public server fns ----------

export const advanceProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    let state: State = await stepParse(data.match_id, trace_id);
    if (state === "parsed") state = await stepEnrich(data.match_id, trace_id);
    if (state === "ready_to_score") state = await stepScore(data.match_id, trace_id);
    return { ok: true, state, trace_id };
  });

export const retryParse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    const state = await stepParse(data.match_id, trace_id);
    return { ok: true, state, trace_id };
  });

export const markOcrDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ match_id: z.string().uuid(), ocr_text: z.string().min(60).max(200_000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    const supabase = (await getAdmin()) as AnyRow;
    const ctx = await loadMatchContext(data.match_id);
    if (!ctx.file) return { ok: false as const, state: "failed" as State, trace_id };
    await supabase
      .from("files")
      .update({
        extracted_text: data.ocr_text,
        ocr_used: true,
        extraction_completed_at: new Date().toISOString(),
        extraction_attempts: (ctx.file.extraction_attempts ?? 0) + 1,
      })
      .eq("id", ctx.file.id);
    await setState(data.match_id, "parsed", { trace_id });
    const s1 = await stepEnrich(data.match_id, trace_id);
    if (s1 !== "ready_to_score") return { ok: true as const, state: s1, trace_id };
    const s2 = await stepScore(data.match_id, trace_id);
    return { ok: true as const, state: s2, trace_id };
  });

export const rescore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    // Refresh evidence snapshot then score. Completed runs are immutable — a new one is
    // written UNLESS the input hash matches a completed run for this match, in which case
    // that run is reused (idempotent rescore).
    let state = await stepEnrich(data.match_id, trace_id);
    if (state === "ready_to_score") state = await stepScore(data.match_id, trace_id);
    return { ok: true, state, trace_id };
  });

// ---------- Phase 6: narrow admin actions ----------

export const retryHydration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const { runHydrationOnly } = await import("./pipeline-runner.server");
    const out = await runHydrationOnly(data.match_id);
    return { ok: out.final_state !== "failed", state: out.final_state, trace_id: out.trace_id };
  });

export const retryEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const { runEnrichmentOnly } = await import("./pipeline-runner.server");
    const out = await runEnrichmentOnly(data.match_id);
    return { ok: out.final_state !== "failed", state: out.final_state, trace_id: out.trace_id };
  });

/**
 * Bulk backfill: re-run enrichment on every candidate match whose evidence is
 * missing structured insights (or that has no evidence row yet). Skips matches
 * without usable CV text so the pipeline doesn't churn on unrecoverable rows.
 * Returns a summary of processed / skipped / failed match ids.
 */
export const backfillCandidateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const limit = data.limit ?? 200;

    const { data: matches } = await supabase
      .from("candidate_matches")
      .select(
        "id,candidate_profile_id,candidate_evidence(extracted),candidate_profiles!inner(current_cv_file_id,files:current_cv_file_id(extracted_text))",
      )
      .limit(limit);

    const targets: string[] = [];
    for (const row of (matches ?? []) as AnyRow[]) {
      const ev = Array.isArray(row.candidate_evidence)
        ? row.candidate_evidence[0]
        : row.candidate_evidence;
      const hasInsights =
        ev?.extracted && typeof ev.extracted === "object" && ev.extracted.insights ? true : false;
      const cvText = row.candidate_profiles?.files?.extracted_text ?? "";
      if (!hasInsights && cvText && cvText.length >= 60) targets.push(row.id as string);
    }

    const { runEnrichmentOnly } = await import("./pipeline-runner.server");
    const processed: string[] = [];
    const failed: { match_id: string; message: string }[] = [];
    for (const id of targets) {
      try {
        const out = await runEnrichmentOnly(id);
        if (out.final_state === "failed")
          failed.push({ match_id: id, message: "enrichment_failed" });
        else processed.push(id);
      } catch (err) {
        failed.push({ match_id: id, message: (err as Error).message ?? "error" });
      }
    }

    return {
      ok: true,
      scanned: (matches ?? []).length,
      targeted: targets.length,
      processed: processed.length,
      failed,
    };
  });

export const markManualReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ match_id: z.string().uuid(), reason: z.string().trim().min(3).max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const { forceManualReview } = await import("./pipeline-runner.server");
    const out = await forceManualReview(data.match_id, data.reason);
    return { ok: true, state: out.final_state, trace_id: out.trace_id };
  });

const replaceCvInput = z.object({
  match_id: z.string().uuid(),
  cv: z.object({
    filename: z.string().min(1).max(200),
    mime: z.string().min(1).max(120),
    base64: z.string().min(100),
  }),
});

export const replaceCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => replaceCvInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    const supabase = (await getAdmin()) as AnyRow;
    const { data: m } = await supabase
      .from("candidate_matches")
      .select("id,candidate_profile_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m?.candidate_profile_id) return { ok: false as const, code: "match_not_found", trace_id };

    // Decode + validate CV
    const clean = data.cv.base64.includes(",") ? data.cv.base64.split(",", 2)[1] : data.cv.base64;
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { validateCv } = await import("./cv-validation");
    const v = await validateCv(bytes, data.cv.filename, data.cv.mime);
    if (!v.ok)
      return { ok: false as const, code: v.code ?? "invalid_cv", message: v.message, trace_id };

    const safe = data.cv.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "cv";
    const storagePath = `candidate/${m.candidate_profile_id}/${Date.now()}-admin-${safe}`;
    const up = await supabase.storage.from("cvs").upload(storagePath, bytes, {
      contentType: v.detected_mime ?? data.cv.mime,
      upsert: false,
    });
    if (up.error)
      return { ok: false as const, code: "upload_failed", message: up.error.message, trace_id };

    const { data: fileRow, error: fileErr } = await supabase
      .from("files")
      .insert({
        candidate_profile_id: m.candidate_profile_id,
        storage_bucket: "cvs",
        storage_path: storagePath,
        filename: data.cv.filename,
        mime_type: v.detected_mime ?? data.cv.mime,
        size: bytes.length,
        checksum: v.sha256 ?? null,
        file_status: "ready",
      })
      .select("id")
      .single();
    if (fileErr)
      return { ok: false as const, code: "file_insert_failed", message: fileErr.message, trace_id };

    await supabase
      .from("candidate_profiles")
      .update({ current_cv_file_id: fileRow.id })
      .eq("id", m.candidate_profile_id);

    // Reset match to queued so the pipeline re-parses from scratch.
    await supabase
      .from("candidate_matches")
      .update({
        processing_state: "queued",
        processing_error_code: null,
        processing_error_message: null,
        last_processing_trace_id: trace_id,
      })
      .eq("id", data.match_id);

    await supabase.from("processing_jobs").insert({
      entity_type: "candidate_match",
      entity_id: data.match_id,
      job_type: "replace_cv",
      status: "completed",
      trace_id,
      completed_at: new Date().toISOString(),
    });

    // Fire-and-forget pipeline; cron drain covers interrupted runs.
    try {
      const { runPipelineForMatch } = await import("./pipeline-runner.server");
      void runPipelineForMatch(data.match_id, { force: true }).catch(() => undefined);
    } catch {
      /* swallow */
    }

    return { ok: true as const, state: "queued" as State, trace_id, file_id: fileRow.id };
  });

const ADMIN_REJECT_CODES = new Set(ADMIN_REJECTION_REASONS.map((r) => r.code));

const decisionInput = z
  .object({
    match_id: z.string().uuid(),
    action: z.enum(["approve_for_client", "hold", "archive", "manual_override"]),
    approved_score: z.number().min(0).max(100).optional(),
    reason: z.string().max(1000).optional(),
    reason_code: z.string().max(64).optional(),
  })
  .superRefine((v, ctx) => {
    // A rejection can never be saved without attribution to a controlled reason.
    if (v.action !== "archive") return;
    if (!v.reason_code || !ADMIN_REJECT_CODES.has(v.reason_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason_code"],
        message: "A rejection reason is required.",
      });
      return;
    }
    if (v.reason_code === "other" && !(v.reason ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Add a short explanation for 'Other'.",
      });
    }
  });

export const applyReviewDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    // One trace id per decision attempt — echoed in audit_events and to the UI.
    const decisionTrace = `review-${data.action}-${crypto.randomUUID()}`;
    const { data: match } = await supabase
      .from("candidate_matches")
      .select(
        "id,current_score_run_id,approved_score_run_id,organization_id,canonical_state,admin_status,client_visibility,stage,integrity_status",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) throw new Error("match_not_found");

    const snapshot = (row: AnyRow | null) => ({
      canonical_state: row?.canonical_state ?? null,
      admin_status: row?.admin_status ?? null,
      client_visibility: row?.client_visibility ?? null,
      stage: row?.stage ?? null,
      integrity_status: row?.integrity_status ?? null,
      approved_score_run_id: row?.approved_score_run_id ?? null,
      current_score_run_id: row?.current_score_run_id ?? null,
    });
    const beforeState = snapshot(match);

    const writeAudit = async (action: string, after: Record<string, unknown>) => {
      try {
        await supabase.from("audit_events").insert({
          actor_user_id: context.userId,
          organization_id: match.organization_id ?? null,
          entity_type: "candidate_match",
          entity_id: data.match_id,
          action,
          before_state: beforeState,
          after_state: after,
          trace_id: decisionTrace,
        });
      } catch (auditErr) {
        console.error("[applyReviewDecision] audit write failed", decisionTrace, auditErr);
      }
    };

    const runIdForDecision = match.current_score_run_id ?? match.approved_score_run_id;
    if (!runIdForDecision) throw new Error("no_score_run_yet");

    if (data.action === "manual_override") {
      if (data.approved_score == null) throw new Error("approved_score_required");
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: runIdForDecision,
        decision_type: "override",
        approved_score: data.approved_score,
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      await writeAudit("score_manual_override", {
        ...beforeState,
        score_run_id: runIdForDecision,
        approved_score: data.approved_score,
        reason: data.reason ?? null,
      });
      return { ok: true as const, action: data.action, trace_id: decisionTrace };
    }

    if (data.action === "approve_for_client") {
      // Canonical publish gate: identity + status + evidence + contradiction.
      const gate = await assertPublishGate(data.match_id, runIdForDecision);
      if (!gate.ok) {
        await writeAudit("score_approval_blocked", {
          ...beforeState,
          score_run_id: runIdForDecision,
          blocked_reason: gate.reason,
          reason: data.reason ?? null,
        });
        throw new Error(`publish_blocked:${gate.reason}`);
      }

      // Evidence completeness gate: every must-have criterion needs at least one
      // piece of evidence, or a recorded override with a written justification.
      const { evidenceGateBlockers } = await import("@/lib/evidence/completeness.server");
      const blockers = await evidenceGateBlockers(supabase, data.match_id);
      if (blockers.length > 0) {
        await writeAudit("score_approval_blocked", {
          ...beforeState,
          score_run_id: runIdForDecision,
          blocked_reason: "evidence_incomplete",
          missing_criteria: blockers,
          reason: data.reason ?? null,
        });
        throw new Error(`publish_blocked:evidence_incomplete:${blockers.join(" | ")}`);
      }

      // Single-transaction, idempotent approval. The RPC locks the match row,
      // inserts the approve decision at most once per (match, run), walks the
      // legal canonical-state path, and publishes — all atomically. Repeated
      // clicks return `already: true` instead of failing or half-updating.
      const { data: rpcResult, error: rpcError } = await supabase.rpc("approve_candidate_match", {
        _match_id: data.match_id,
        _run_id: runIdForDecision,
        _actor_user_id: context.userId,
        _reason: data.reason ?? null,
        _trace_id: decisionTrace,
      });
      if (rpcError) {
        await writeAudit("score_approval_failed", {
          ...beforeState,
          score_run_id: runIdForDecision,
          error: rpcError.message,
          reason: data.reason ?? null,
        });
        throw new Error(`publish_failed:${rpcError.message}`);
      }
      const published = (rpcResult ?? null) as {
        already?: boolean;
        match_id?: string;
        trace_id?: string;
        state_path?: string[];
        canonical_state?: string;
        admin_status?: string;
        client_visibility?: string;
        stage?: string;
        approved_score_run_id?: string;
        delivered_at?: string | null;
        organization_id?: string | null;
        position_id?: string | null;
        application_id?: string | null;
        candidate_profile_id?: string | null;
      } | null;
      if (!published || published.client_visibility !== "visible") {
        await writeAudit("score_approval_failed", {
          ...beforeState,
          score_run_id: runIdForDecision,
          error: "not_visible_after_update",
        });
        throw new Error("publish_failed:not_visible_after_update");
      }
      if (published.already) {
        // Nothing new to announce; the client already has this candidate.
        // The RPC already wrote a `score_approval_noop` audit row.
        return {
          ok: true as const,
          action: data.action,
          already: true,
          trace_id: decisionTrace,
          match: published,
        };
      }
      // The successful `score_approved` audit row is written inside the RPC
      // transaction, so it can never disagree with the published state.

      // Emit candidate_published to the client org (visible delivery)
      try {
        const { emitEventFromServer } = await import("./notifications.functions");
        const { data: matchRow } = await supabase
          .from("candidate_matches")
          .select(
            "organization_id, position_id, application_id, candidate_profile_id, candidate_profiles:candidate_profile_id(user_id)",
          )
          .eq("id", data.match_id)
          .maybeSingle();
        const cpUser =
          (matchRow?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
        await emitEventFromServer({
          event: "candidate_published",
          scope: data.match_id,
          organization_id: matchRow?.organization_id ?? null,
          position_id: matchRow?.position_id ?? null,
          application_id: matchRow?.application_id ?? null,
          candidate_match_id: data.match_id,
          candidate_profile_id: matchRow?.candidate_profile_id ?? null,
          actor_user_id: context.userId,
          link_path: `/client/candidates`,
        });
        if (cpUser) {
          await emitEventFromServer({
            event: "candidate_published",
            scope: `candidate:${data.match_id}`,
            candidate_match_id: data.match_id,
            candidate_profile_id: matchRow?.candidate_profile_id ?? null,
            recipients: [
              {
                user_id: cpUser,
                audience: "candidate",
                link_path: `/me/applications/${matchRow?.application_id ?? ""}`,
              },
            ],
          });
        }
      } catch (emitErr) {
        console.error("[approve_for_client] emit failed", emitErr);
      }
      return {
        ok: true as const,
        action: data.action,
        already: false,
        trace_id: published.trace_id ?? decisionTrace,
        match: published,
      };
    }

    // Hold and archive both use decision_type='reject' since the enum has no hold/archive.
    // admin_status / client_visibility disambiguate the operational state.
    await supabase.from("score_decisions").insert({
      candidate_match_id: data.match_id,
      score_run_id: runIdForDecision,
      decision_type: "reject",
      // Holds are parked under the reserved `hold` code so rejection reporting
      // never counts them as rejections.
      reason_code: data.action === "hold" ? "hold" : (data.reason_code ?? null),
      stage_at_decision: (match.stage as string) ?? null,
      reason: (data.action === "hold" ? "HOLD: " : "ARCHIVE: ") + (data.reason ?? ""),
      actor_user_id: context.userId,
    });
    if (data.action === "hold") {
      await supabase
        .from("candidate_matches")
        .update({ admin_status: "on_hold" })
        .eq("id", data.match_id);
    } else {
      await supabase
        .from("candidate_matches")
        .update({ admin_status: "rejected", client_visibility: "archived", stage: "archived" })
        .eq("id", data.match_id);
    }
    const { data: afterRow } = await supabase
      .from("candidate_matches")
      .select(
        "canonical_state,admin_status,client_visibility,stage,integrity_status,approved_score_run_id,current_score_run_id",
      )
      .eq("id", data.match_id)
      .maybeSingle();
    await writeAudit(data.action === "hold" ? "score_held" : "score_archived", {
      ...snapshot(afterRow),
      score_run_id: runIdForDecision,
      reason: data.reason ?? null,
    });
    return { ok: true as const, action: data.action, trace_id: decisionTrace };
  });

// Permanently purge a candidate match. Works regardless of score state — admins can
// remove a candidate and its dependent application/profile/scoring data from the database.
export const deleteCandidateMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        reason: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data: match, error: matchError } = await supabase
      .from("candidate_matches")
      .select("id,candidate_profile_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (matchError) throw new Error(`delete_failed:${matchError.message}`);
    if (!match) throw new Error("match_not_found");

    const { data: files } = await supabase
      .from("files")
      .select("storage_bucket,storage_path")
      .eq("candidate_profile_id", match.candidate_profile_id);

    const { data: deleted, error } = await supabase.rpc("hard_delete_candidate_match", {
      _match_id: data.match_id,
      _actor_user_id: context.userId,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(`delete_failed:${error.message}`);

    for (const file of files ?? []) {
      if (file.storage_bucket && file.storage_path) {
        await supabase.storage.from(file.storage_bucket).remove([file.storage_path]);
      }
    }

    return { ok: true as const, action: "delete" as const, deleted };
  });

// ---------- admin queries ----------

export const listAdminMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ include_archived: z.boolean().optional() })
      .partial()
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    let q = supabase
      .from("candidate_matches")
      .select(
        "id,processing_state,admin_status,client_visibility,updated_at,current_score_run_id,candidate_profiles(full_name,email),positions(title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label,must_have_coverage,contradiction_status)",
      );
    if (!data.include_archived) {
      // Hide deleted/archived rows so the admin list reflects the delete action.
      q = q.neq("client_visibility", "archived").neq("admin_status", "rejected");
    }
    const { data: rows } = await q.order("updated_at", { ascending: false }).limit(200);
    return (rows ?? []).map((m: AnyRow) => {
      const cp = m.candidate_profiles;
      const pos = m.positions;
      const sr = m.score_runs;
      return {
        id: m.id as string,
        candidate_name: cp?.full_name ?? "—",
        candidate_email: cp?.email ?? "—",
        position_title: pos?.title ?? "—",
        organization_name: pos?.organizations?.name ?? "—",
        processing_state: m.processing_state as State,
        admin_status: m.admin_status as string,
        client_visibility: m.client_visibility as string,
        score: (sr?.score as number) ?? null,
        fit_label: (sr?.fit_label as string) ?? null,
        must_have_coverage: (sr?.must_have_coverage as number) ?? null,
        contradiction_status: (sr?.contradiction_status as string) ?? null,
        updated_at: m.updated_at as string,
      };
    });
  });

export const getAdminMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        // The detail route opens on the profile tab, which never reads the large
        // payloads (score run results, raw CV text). It passes heavy:false and
        // fetches the rest through getMatchHeavyDetail when a tab needs it.
        heavy: z.boolean().optional().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const heavy = data.heavy !== false;
    const supabase = (await getAdmin()) as AnyRow;
    const { data: m, error } = await supabase
      .from("candidate_matches")
      .select(
        "id,application_id,candidate_profile_id,position_id,organization_id,stage,created_at,processing_state,processing_error_code,processing_error_message,last_processing_trace_id,admin_status,client_visibility,current_score_run_id,approved_score_run_id,canonical_state,integrity_status,updated_at,candidate_profiles(id,full_name,email,phone,location,timezone,headline,summary,years_experience,linkedin_url,skills,experience,education,languages,work_authorization,availability,compensation_preferences,consent),positions(id,title,description,requirements,preferred_requirements,status,organizations(id,name))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !m) return null;

    const cpId = (m.candidate_profiles as AnyRow)?.id ?? "";
    const [runsRes, decisionsRes, jobsRes, evidenceRes, fileRes, siblingsRes] = await Promise.all([
      supabase
        .from("score_runs")
        .select(
          heavy
            ? "id,score,confidence,status,fit_label,must_have_coverage,preferred_coverage,contradiction_status,explanation,result,completed_at,engine_version,input_hash"
            : "id,score,confidence,status,fit_label,must_have_coverage,preferred_coverage,contradiction_status,completed_at,engine_version,input_hash",
        )
        .eq("candidate_match_id", data.id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("score_decisions")
        .select("id,decision_type,approved_score,reason,actor_user_id,created_at")
        .eq("candidate_match_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("processing_jobs")
        .select("id,job_type,status,error_code,error_message,trace_id,created_at,completed_at")
        .eq("entity_type", "candidate_match")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("candidate_evidence")
        .select(
          heavy
            ? "id,engine_version,extracted,screening_normalized,raw_text_sample,created_at"
            : "id,engine_version,extracted,screening_normalized,created_at",
        )
        .eq("candidate_match_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("files")
        .select(
          heavy
            ? "id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extracted_text,extraction_completed_at,extraction_attempts"
            : "id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extraction_completed_at,extraction_attempts",
        )
        .eq("candidate_profile_id", cpId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("candidate_matches")
        .select("id,positions(title)")
        .eq("candidate_profile_id", cpId)
        .order("created_at", { ascending: false }),
    ]);

    // Lifetime of a staff CV preview link. Short by design; re-signed on demand.
    const CV_URL_TTL_SECONDS = 300;
    let cv_signed_url: string | null = null;
    let cv_url_expires_at: string | null = null;
    // Signing costs a storage round trip; only the CV tab renders the preview.
    if (heavy && fileRes.data) {
      const signed = await supabase.storage
        .from(fileRes.data.storage_bucket)
        .createSignedUrl(fileRes.data.storage_path, CV_URL_TTL_SECONDS);
      cv_signed_url = signed.data?.signedUrl ?? null;
      // The reviewer needs to know when the preview link dies, not discover it
      // through a broken iframe halfway through a decision.
      if (cv_signed_url) {
        cv_url_expires_at = new Date(Date.now() + CV_URL_TTL_SECONDS * 1000).toISOString();
      }
    }

    return {
      match: m,
      runs: runsRes.data ?? [],
      decisions: decisionsRes.data ?? [],
      jobs: jobsRes.data ?? [],
      evidence: evidenceRes.data ?? null,
      cv: fileRes.data
        ? { ...fileRes.data, signed_url: cv_signed_url, url_expires_at: cv_url_expires_at }
        : null,
      siblings: ((siblingsRes.data ?? []) as AnyRow[]).map((s) => ({
        id: s.id as string,
        position_title: (s.positions as AnyRow)?.title ?? "—",
      })),
    };
  });

// Large payloads for the candidate workspace tabs that actually render them:
// score-run results/explanations, the raw CV text and the signed preview URL.
// Fetched only when such a tab opens, so opening a candidate stays cheap.
export const getMatchHeavyDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data: m } = await supabase
      .from("candidate_matches")
      .select("id,candidate_profile_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!m) return null;

    const [runsRes, evidenceRes, fileRes] = await Promise.all([
      supabase
        .from("score_runs")
        .select(
          "id,score,confidence,status,fit_label,must_have_coverage,preferred_coverage,contradiction_status,explanation,result,completed_at,engine_version,input_hash",
        )
        .eq("candidate_match_id", data.id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("candidate_evidence")
        .select("id,engine_version,extracted,screening_normalized,raw_text_sample,created_at")
        .eq("candidate_match_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("files")
        .select(
          "id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extracted_text,extraction_completed_at,extraction_attempts",
        )
        .eq("candidate_profile_id", m.candidate_profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const CV_URL_TTL_SECONDS = 300;
    let cv_signed_url: string | null = null;
    let cv_url_expires_at: string | null = null;
    if (fileRes.data) {
      const signed = await supabase.storage
        .from(fileRes.data.storage_bucket)
        .createSignedUrl(fileRes.data.storage_path, CV_URL_TTL_SECONDS);
      cv_signed_url = signed.data?.signedUrl ?? null;
      if (cv_signed_url) {
        cv_url_expires_at = new Date(Date.now() + CV_URL_TTL_SECONDS * 1000).toISOString();
      }
    }

    return {
      runs: runsRes.data ?? [],
      evidence: evidenceRes.data ?? null,
      cv: fileRes.data
        ? { ...fileRes.data, signed_url: cv_signed_url, url_expires_at: cv_url_expires_at }
        : null,
    };
  });

// Download a consolidated evidence record as JSON (staff only).
export const downloadEvidenceRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data: m } = await supabase
      .from("candidate_matches")
      .select(
        "id,position_id,candidate_profile_id,organization_id,processing_state,admin_status,client_visibility,current_score_run_id,created_at,updated_at,candidate_profiles(full_name,email,headline,location),positions(title,organizations(name))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!m) throw new Error("not_found");
    const [ev, runs, file, audit] = await Promise.all([
      supabase
        .from("candidate_evidence")
        .select("id,engine_version,extracted,screening_normalized,raw_text_sample,created_at")
        .eq("candidate_match_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("score_runs")
        .select(
          "id,score,fit_label,must_have_coverage,contradiction_status,engine_version,completed_at,explanation",
        )
        .eq("candidate_match_id", data.id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("files")
        .select(
          "id,filename,mime_type,size,ocr_used,extracted_text,extraction_completed_at,created_at",
        )
        .eq("candidate_profile_id", (m.candidate_profiles as AnyRow)?.id ?? m.candidate_profile_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("audit_events")
        .select("id,event_type,payload,actor_user_id,created_at")
        .eq("entity_type", "candidate_match")
        .eq("entity_id", data.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return {
      exported_at: new Date().toISOString(),
      match: m,
      evidence: ev.data ?? [],
      score_runs: runs.data ?? [],
      cv: file.data ?? null,
      audit: audit.data ?? [],
    } as Json;
  });


/**
 * Re-sign the CV preview link for a match. Called when the reviewer comes back
 * to the tab or hits refresh, so a long review never dies on an expired URL.
 */
export const resignAdminCvUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const CV_URL_TTL_SECONDS = 300;
    const supabase = (await getAdmin()) as AnyRow;
    const { data: match } = await supabase
      .from("candidate_matches")
      .select("candidate_profile_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match?.candidate_profile_id) return { signed_url: null, url_expires_at: null };
    const { data: file } = await supabase
      .from("files")
      .select("storage_bucket,storage_path")
      .eq("candidate_profile_id", match.candidate_profile_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!file) return { signed_url: null, url_expires_at: null };
    const signed = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, CV_URL_TTL_SECONDS);
    const url = signed.data?.signedUrl ?? null;
    return {
      signed_url: url,
      url_expires_at: url ? new Date(Date.now() + CV_URL_TTL_SECONDS * 1000).toISOString() : null,
    };
  });
