// Processing pipeline for candidate matches.
// State machine (see architecture note in advanceProcessing):
//   queued → parsing → (ocr_required) → parsed → enriching →
//   ready_to_score → scoring → scored → manual_review_required?
// Terminal error branches: provider_blocked, failed.
//
// Every advance step is:
//   - idempotent (safe to call twice for the same match)
//   - side-effect scoped to one match
//   - recorded with a trace id + processing_job row
//   - never rewrites completed score runs

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ENGINE_VERSION,
  scoreCandidate,
  type RequirementInput,
  type ScreeningAnswer,
  type ScoringResult,
} from "@/lib/scoring-engine.server";

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
  | "requirements_missing"
  | "provider_error"
  | "position_inactive"
  | "engine_error";

function traceId() {
  return `pr_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// Very lightweight text extractor. It is intentionally naive:
//   - reads raw bytes and pulls printable ASCII runs
//   - for text/plain / docx-xml / html this gets meaningful text
//   - for PDFs it often yields little (compressed streams) → we mark ocr_required
// A real deployment would swap in a proper PDF parser. Interface is stable.
async function extractText(bytes: Uint8Array, mime: string): Promise<{ text: string; needs_ocr: boolean }> {
  const td = new TextDecoder("utf-8", { fatal: false });
  const decoded = td.decode(bytes);
  const printable = decoded.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();

  // Strip XML tags for docx / html.
  const stripped = printable.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = stripped.length > printable.length * 0.3 ? stripped : printable;

  // A binary PDF that only surfaces stream markers gives us < ~200 usable chars.
  const looksLikePdf = mime.includes("pdf") || bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50;
  const needs_ocr = text.length < 200 && looksLikePdf;
  return { text, needs_ocr };
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadMatchContext(matchId: string) {
  const supabase = await getAdmin();
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
    .select("id,title,status,description,requirements,preferred_requirements,scoring_rubric")
    .eq("id", match.position_id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("id,full_name,email,current_cv_file_id,skills,experience")
    .eq("id", match.candidate_profile_id)
    .maybeSingle();

  const { data: file } = profile?.current_cv_file_id
    ? await supabase
        .from("files")
        .select("id,storage_bucket,storage_path,mime_type,extracted_text,ocr_used,extraction_attempts")
        .eq("id", profile.current_cv_file_id)
        .maybeSingle()
    : { data: null };

  const { data: answers } = await supabase
    .from("application_answers")
    .select("question_id,answer_value,screening_questions(question,answer_type,required,disqualifying_condition)")
    .eq("application_id", match.application_id);

  return { match, position, profile, file, answers: answers ?? [] };
}

async function setState(
  matchId: string,
  state: State,
  opts: { trace_id?: string; code?: string | null; message?: string | null } = {},
) {
  const supabase = await getAdmin();
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
  const supabase = await getAdmin();
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
  const pref = Array.isArray(pos.preferred_requirements) ? (pos.preferred_requirements as string[]) : [];
  return [
    ...req.map((t, i) => ({ id: `req-${i}`, text: String(t), required: true, keywords: [] })),
    ...pref.map((t, i) => ({ id: `pref-${i}`, text: String(t), required: false, keywords: [] })),
  ];
}

function buildScreening(
  rows: Array<{
    question_id: string;
    answer_value: unknown;
    screening_questions:
      | { question: string; answer_type: string; required: boolean; disqualifying_condition: unknown }
      | Array<{ question: string; answer_type: string; required: boolean; disqualifying_condition: unknown }>
      | null;
  }>,
): ScreeningAnswer[] {
  return rows.map((r) => {
    const q = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
    return {
      question_id: r.question_id,
      question: q?.question ?? "",
      required: q?.required ?? false,
      answer_type: q?.answer_type ?? "short_text",
      value: r.answer_value,
      disqualifying_condition:
        (q?.disqualifying_condition as ScreeningAnswer["disqualifying_condition"]) ?? null,
    };
  });
}

// ---------- individual steps ----------

async function stepParse(matchId: string, trace_id: string): Promise<State> {
  const supabase = await getAdmin();
  const ctx = await loadMatchContext(matchId);
  if (!ctx.file) {
    await setState(matchId, "failed", { trace_id, code: "cv_unreadable", message: "No CV on file." });
    await recordJob(matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: "No CV on file." });
    return "failed";
  }

  await setState(matchId, "parsing", { trace_id });

  // Skip re-download when text was already extracted successfully.
  if (ctx.file.extracted_text && ctx.file.extracted_text.length >= 200) {
    await setState(matchId, "parsed", { trace_id });
    return "parsed";
  }

  const dl = await supabase.storage.from(ctx.file.storage_bucket).download(ctx.file.storage_path);
  if (dl.error || !dl.data) {
    await setState(matchId, "failed", { trace_id, code: "cv_unreadable", message: dl.error?.message ?? "download_failed" });
    await recordJob(matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: dl.error?.message ?? "download_failed" });
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
    await setState(matchId, "ocr_required", { trace_id, code: "cv_unreadable", message: "PDF text extraction yielded no usable content." });
    return "ocr_required";
  }
  await setState(matchId, "parsed", { trace_id });
  return "parsed";
}

async function stepEnrich(matchId: string, trace_id: string): Promise<State> {
  const supabase = await getAdmin();
  const ctx = await loadMatchContext(matchId);
  await setState(matchId, "enriching", { trace_id });

  const cvText = ctx.file?.extracted_text ?? "";
  const screening = buildScreening(ctx.answers);

  // Persist per-match evidence snapshot.
  await supabase.from("candidate_evidence").upsert(
    {
      candidate_match_id: matchId,
      candidate_profile_id: ctx.match.candidate_profile_id,
      cv_file_id: ctx.file?.id ?? null,
      engine_version: ENGINE_VERSION,
      extracted: {
        cv_length: cvText.length,
        skills: ctx.profile?.skills ?? [],
        experience: ctx.profile?.experience ?? [],
      },
      screening_normalized: {
        answers: screening.map((s) => ({
          question_id: s.question_id,
          question: s.question,
          value: s.value,
          answer_type: s.answer_type,
          required: s.required,
        })),
      },
      raw_text_sample: cvText.slice(0, 800),
    },
    { onConflict: "candidate_match_id,engine_version" },
  );

  const pos = ctx.position;
  if (!pos || pos.status !== "active") {
    await setState(matchId, "manual_review_required", {
      trace_id,
      code: "position_inactive",
      message: `Position is ${pos?.status ?? "missing"}. Manual review required.`,
    });
    return "manual_review_required";
  }
  const reqs = buildRequirements(pos);
  if (reqs.length === 0) {
    await setState(matchId, "manual_review_required", {
      trace_id,
      code: "requirements_missing",
      message: "Position has no structured requirements.",
    });
    return "manual_review_required";
  }

  await setState(matchId, "ready_to_score", { trace_id });
  return "ready_to_score";
}

async function stepScore(matchId: string, trace_id: string): Promise<State> {
  const supabase = await getAdmin();
  const ctx = await loadMatchContext(matchId);
  await setState(matchId, "scoring", { trace_id });

  const cvText = ctx.file?.extracted_text ?? "";
  const requirements = buildRequirements(ctx.position ?? { requirements: [], preferred_requirements: [] });
  const screening = buildScreening(ctx.answers);

  let result: ScoringResult;
  try {
    result = scoreCandidate({ cv_text: cvText, requirements, screening });
  } catch (err) {
    await setState(matchId, "failed", { trace_id, code: "engine_error", message: (err as Error).message });
    await recordJob(matchId, "score", "failed", trace_id, { code: "engine_error", message: (err as Error).message });
    return "failed";
  }

  // Dedupe: if a completed run already exists with the same input_hash for this match,
  // reuse it instead of writing a duplicate.
  const { data: existing } = await supabase
    .from("score_runs")
    .select("id,input_hash,status")
    .eq("candidate_match_id", matchId)
    .eq("input_hash", result.input_hash)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  let runId: string;
  if (existing?.id) {
    runId = existing.id;
  } else {
    const { data: run, error: runErr } = await supabase
      .from("score_runs")
      .insert({
        candidate_match_id: matchId,
        position_id: ctx.match.position_id,
        engine_version: ENGINE_VERSION,
        score: result.score,
        confidence: result.overall_confidence,
        status: "completed",
        explanation: [
          `${result.fit_label.replace(/_/g, " ")} • must-have coverage ${(result.must_have_coverage * 100).toFixed(0)}%`,
          result.strengths[0] ?? null,
          result.concerns[0] ?? null,
        ].filter(Boolean).join(" — "),
        evidence: result.evidence,
        requirement_coverage: {
          must_have: result.category_breakdown.must_have,
          preferred: result.category_breakdown.preferred,
          screening_alignment: result.category_breakdown.screening_alignment,
        },
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        trace_id,
        result: result as unknown as Record<string, unknown>,
        fit_label: result.fit_label,
        must_have_coverage: result.must_have_coverage,
        preferred_coverage: result.preferred_coverage,
        contradiction_status: result.contradiction_status,
        input_hash: result.input_hash,
      })
      .select("id")
      .single();
    if (runErr || !run) {
      await setState(matchId, "failed", { trace_id, code: "engine_error", message: runErr?.message ?? "insert_failed" });
      await recordJob(matchId, "score", "failed", trace_id, { code: "engine_error", message: runErr?.message ?? "insert_failed" });
      return "failed";
    }
    runId = run.id;
  }

  await supabase
    .from("candidate_matches")
    .update({ current_score_run_id: runId })
    .eq("id", matchId);

  // Route: contradictions / disqualifying → manual review; otherwise scored.
  const nextState: State =
    result.contradiction_status === "disqualifying_answer" || result.overall_confidence < 0.35
      ? "manual_review_required"
      : "scored";

  await setState(matchId, nextState, { trace_id });
  await recordJob(matchId, "score", "completed", trace_id);
  return nextState;
}

// ---------- public server fns ----------

async function assertStaff() {
  const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
  void requireSupabaseAuth; // typed side-effect import
}

async function isStaff(userId: string) {
  const supabase = await getAdmin();
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  return !!data;
}

const { requireSupabaseAuth: rsa } = await Promise.resolve(await import("@/integrations/supabase/auth-middleware"));

// Full pipeline advance: parse → enrich → score (idempotent from any earlier state).
export const advanceProcessing = createServerFn({ method: "POST" })
  .middleware([rsa])
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
  .middleware([rsa])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    const state = await stepParse(data.match_id, trace_id);
    return { ok: true, state, trace_id };
  });

export const markOcrDone = createServerFn({ method: "POST" })
  .middleware([rsa])
  .inputValidator((input: unknown) =>
    z.object({ match_id: z.string().uuid(), ocr_text: z.string().min(60).max(200_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    const supabase = await getAdmin();
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
  .middleware([rsa])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const trace_id = traceId();
    // Enrich (refresh evidence snapshot) then score. Any completed run is immutable — a new one is written unless input hash matches.
    let state = await stepEnrich(data.match_id, trace_id);
    if (state === "ready_to_score") state = await stepScore(data.match_id, trace_id);
    return { ok: true, state, trace_id };
  });

const decisionInput = z.object({
  match_id: z.string().uuid(),
  action: z.enum(["approve_for_client", "hold", "archive", "manual_override"]),
  approved_score: z.number().min(0).max(100).optional(),
  reason: z.string().max(1000).optional(),
});

export const applyReviewDecision = createServerFn({ method: "POST" })
  .middleware([rsa])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = await getAdmin();
    const { data: match } = await supabase
      .from("candidate_matches")
      .select("id,current_score_run_id,approved_score_run_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) throw new Error("match_not_found");

    if (data.action === "manual_override") {
      if (!match.current_score_run_id) throw new Error("no_current_run");
      if (data.approved_score == null) throw new Error("approved_score_required");
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: match.current_score_run_id,
        decision_type: "override",
        approved_score: data.approved_score,
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      return { ok: true as const, action: data.action };
    }

    const decisionType =
      data.action === "approve_for_client" ? "approve" : data.action === "hold" ? "hold" : "archive";

    if (data.action === "approve_for_client") {
      if (!match.current_score_run_id) throw new Error("no_current_run");
      // Guardrail: publication requires an evidence-backed run.
      const { data: run } = await supabase
        .from("score_runs")
        .select("id,evidence,status,contradiction_status")
        .eq("id", match.current_score_run_id)
        .maybeSingle();
      const evidenceArr = (run?.evidence as unknown as unknown[]) ?? [];
      if (!run || run.status !== "completed" || evidenceArr.length === 0) {
        throw new Error("publish_requires_evidence");
      }
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: match.current_score_run_id,
        decision_type: decisionType,
        approved_score: null,
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      await supabase
        .from("candidate_matches")
        .update({
          approved_score_run_id: match.current_score_run_id,
          admin_status: "approved",
          client_visibility: "visible",
          stage: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", data.match_id);
    } else if (data.action === "hold") {
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: match.current_score_run_id ?? match.approved_score_run_id!,
        decision_type: decisionType,
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      await supabase.from("candidate_matches").update({ admin_status: "on_hold" }).eq("id", data.match_id);
    } else {
      // archive
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: match.current_score_run_id ?? match.approved_score_run_id!,
        decision_type: decisionType,
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      await supabase
        .from("candidate_matches")
        .update({ admin_status: "rejected", client_visibility: "archived", stage: "archived" })
        .eq("id", data.match_id);
    }
    return { ok: true as const, action: data.action };
  });

// Admin listing / detail

export const listAdminMatches = createServerFn({ method: "GET" })
  .middleware([rsa])
  .handler(async ({ context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = await getAdmin();
    const { data } = await supabase
      .from("candidate_matches")
      .select(
        "id,processing_state,admin_status,client_visibility,updated_at,current_score_run_id,candidate_profiles(full_name,email),positions(title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label,must_have_coverage,contradiction_status)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    return (
      data?.map((m) => {
        const cp = m.candidate_profiles as unknown as { full_name: string; email: string } | null;
        const pos = m.positions as unknown as { title: string; organizations: { name: string } | null } | null;
        const sr = m.score_runs as unknown as {
          score: number;
          fit_label: string | null;
          must_have_coverage: number | null;
          contradiction_status: string | null;
        } | null;
        return {
          id: m.id,
          candidate_name: cp?.full_name ?? "—",
          candidate_email: cp?.email ?? "—",
          position_title: pos?.title ?? "—",
          organization_name: pos?.organizations?.name ?? "—",
          processing_state: m.processing_state as State,
          admin_status: m.admin_status,
          client_visibility: m.client_visibility,
          score: sr?.score ?? null,
          fit_label: sr?.fit_label ?? null,
          must_have_coverage: sr?.must_have_coverage ?? null,
          contradiction_status: sr?.contradiction_status ?? null,
          updated_at: m.updated_at,
        };
      }) ?? []
    );
  });

export const getAdminMatch = createServerFn({ method: "GET" })
  .middleware([rsa])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = await getAdmin();
    const { data: m, error } = await supabase
      .from("candidate_matches")
      .select(
        "id,processing_state,processing_error_code,processing_error_message,last_processing_trace_id,admin_status,client_visibility,current_score_run_id,approved_score_run_id,updated_at,candidate_profiles(id,full_name,email,phone,location,skills),positions(id,title,description,requirements,preferred_requirements,status,organizations(name))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !m) return null;

    const [{ data: runs }, { data: decisions }, { data: jobs }, { data: evidence }] = await Promise.all([
      supabase
        .from("score_runs")
        .select("id,score,confidence,status,fit_label,must_have_coverage,preferred_coverage,contradiction_status,explanation,result,completed_at,engine_version,input_hash")
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
        .select("id,engine_version,extracted,screening_normalized,raw_text_sample,created_at")
        .eq("candidate_match_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return { match: m, runs: runs ?? [], decisions: decisions ?? [], jobs: jobs ?? [], evidence: evidence ?? null };
  });
