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

// Naive extractor: pulls printable text from raw bytes, strips XML.
// Real deployments swap this for a proper PDF parser; the interface is stable.
async function extractText(bytes: Uint8Array, mime: string): Promise<{ text: string; needs_ocr: boolean }> {
  const td = new TextDecoder("utf-8", { fatal: false });
  const decoded = td.decode(bytes);
  const printable = decoded.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+/g, " ").replace(/\s+/g, " ").trim();
  const stripped = printable.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
          .select("id,storage_bucket,storage_path,mime_type,extracted_text,ocr_used,extraction_attempts")
          .eq("id", profile.current_cv_file_id)
          .maybeSingle()
      ).data
    : null;

  const { data: answers } = await supabase
    .from("application_answers")
    .select("question_id,answer,screening_questions(question,answer_type,required,dealbreaker,preferred_answer)")
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
  const pref = Array.isArray(pos.preferred_requirements) ? (pos.preferred_requirements as string[]) : [];
  return [
    ...req.map((t, i) => ({ id: `req-${i}`, text: String(t), required: true, keywords: [] })),
    ...pref.map((t, i) => ({ id: `pref-${i}`, text: String(t), required: false, keywords: [] })),
  ];
}

function buildScreening(rows: AnyRow[]): ScreeningAnswer[] {
  return rows.map((r) => {
    const q = Array.isArray(r.screening_questions) ? r.screening_questions[0] : r.screening_questions;
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
    await setState(matchId, "failed", { trace_id, code: "cv_unreadable", message: "No CV on file." });
    await recordJob(matchId, "parse", "failed", trace_id, { code: "cv_unreadable", message: "No CV on file." });
    return "failed";
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
    z.object({ match_id: z.string().uuid(), ocr_text: z.string().min(60).max(200_000) }).parse(input),
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

const decisionInput = z.object({
  match_id: z.string().uuid(),
  action: z.enum(["approve_for_client", "hold", "archive", "manual_override"]),
  approved_score: z.number().min(0).max(100).optional(),
  reason: z.string().max(1000).optional(),
});

export const applyReviewDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data: match } = await supabase
      .from("candidate_matches")
      .select("id,current_score_run_id,approved_score_run_id")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!match) throw new Error("match_not_found");

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
      return { ok: true as const, action: data.action };
    }

    if (data.action === "approve_for_client") {
      // Canonical publish gate: identity + status + evidence + contradiction.
      const gate = await assertPublishGate(data.match_id, runIdForDecision);
      if (!gate.ok) {
        throw new Error(`publish_blocked:${gate.reason}`);
      }
      await supabase.from("score_decisions").insert({
        candidate_match_id: data.match_id,
        score_run_id: runIdForDecision,
        decision_type: "approve",
        reason: data.reason ?? null,
        actor_user_id: context.userId,
      });
      await supabase
        .from("candidate_matches")
        .update({
          approved_score_run_id: runIdForDecision,
          admin_status: "approved",
          client_visibility: "visible",
          stage: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", data.match_id);

      // Emit candidate_published to the client org (visible delivery)
      try {
        const { emitEventFromServer } = await import("./notifications.functions");
        const { data: matchRow } = await supabase
          .from("candidate_matches")
          .select("organization_id, position_id, application_id, candidate_profile_id, candidate_profiles:candidate_profile_id(user_id)")
          .eq("id", data.match_id)
          .maybeSingle();
        const cpUser = (matchRow?.candidate_profiles as { user_id: string | null } | null)?.user_id ?? null;
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
            recipients: [{ user_id: cpUser, audience: "candidate", link_path: `/me/applications/${matchRow?.application_id ?? ""}` }],
          });
        }
      } catch (emitErr) {
        console.error("[approve_for_client] emit failed", emitErr);
      }
      return { ok: true as const, action: data.action };
    }

    // Hold and archive both use decision_type='reject' since the enum has no hold/archive.
    // admin_status / client_visibility disambiguate the operational state.
    await supabase.from("score_decisions").insert({
      candidate_match_id: data.match_id,
      score_run_id: runIdForDecision,
      decision_type: "reject",
      reason: (data.action === "hold" ? "HOLD: " : "ARCHIVE: ") + (data.reason ?? ""),
      actor_user_id: context.userId,
    });
    if (data.action === "hold") {
      await supabase.from("candidate_matches").update({ admin_status: "on_hold" }).eq("id", data.match_id);
    } else {
      await supabase
        .from("candidate_matches")
        .update({ admin_status: "rejected", client_visibility: "archived", stage: "archived" })
        .eq("id", data.match_id);
    }
    return { ok: true as const, action: data.action };
  });

// ---------- admin queries ----------

export const listAdminMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data } = await supabase
      .from("candidate_matches")
      .select(
        "id,processing_state,admin_status,client_visibility,updated_at,current_score_run_id,candidate_profiles(full_name,email),positions(title,organizations(name)),score_runs!candidate_matches_current_score_run_id_fkey(score,fit_label,must_have_coverage,contradiction_status)",
      )
      .order("updated_at", { ascending: false })
      .limit(200);
    return (
      (data ?? []).map((m: AnyRow) => {
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
      })
    );
  });

export const getAdminMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("forbidden");
    const supabase = (await getAdmin()) as AnyRow;
    const { data: m, error } = await supabase
      .from("candidate_matches")
      .select(
        "id,application_id,candidate_profile_id,position_id,organization_id,stage,created_at,processing_state,processing_error_code,processing_error_message,last_processing_trace_id,admin_status,client_visibility,current_score_run_id,approved_score_run_id,updated_at,candidate_profiles(id,full_name,email,phone,location,headline,skills,experience,education,languages,work_authorization,availability,compensation_preferences),positions(id,title,description,requirements,preferred_requirements,status,organizations(id,name))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error || !m) return null;

    const cpId = (m.candidate_profiles as AnyRow)?.id ?? "";
    const [runsRes, decisionsRes, jobsRes, evidenceRes, fileRes, siblingsRes] = await Promise.all([
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
      supabase
        .from("files")
        .select("id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extracted_text,extraction_completed_at,extraction_attempts")
        .eq("candidate_profile_id", (m.candidate_profiles as AnyRow)?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("files")
        .select("id,filename,storage_bucket,storage_path,mime_type,size,ocr_used,extracted_text,extraction_completed_at,extraction_attempts")
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

    let cv_signed_url: string | null = null;
    if (fileRes.data) {
      const signed = await supabase.storage
        .from(fileRes.data.storage_bucket)
        .createSignedUrl(fileRes.data.storage_path, 300);
      cv_signed_url = signed.data?.signedUrl ?? null;
    }

    return {
      match: m,
      runs: runsRes.data ?? [],
      decisions: decisionsRes.data ?? [],
      jobs: jobsRes.data ?? [],
      evidence: evidenceRes.data ?? null,
      cv: fileRes.data ? { ...fileRes.data, signed_url: cv_signed_url } : null,
    };
  });
