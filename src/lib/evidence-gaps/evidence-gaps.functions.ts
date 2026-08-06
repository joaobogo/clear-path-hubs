/**
 * The evidence-gap ledger.
 *
 * Answers one question with data rather than opinion: for every candidate who
 * reached us and has no evidence, which of OUR steps did not finish, and what
 * did we tell them at the time. Nothing here is inferred from a score or a
 * judgement about the person.
 *
 * Read-only. Every row points at a real record; there is no synthetic filler.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GAP_REASONS, resolveGapReason, type GapReason } from "./gap-reasons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type EvidenceGapRow = {
  /** Stable key for the UI list. */
  key: string;
  candidate_profile_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  application_id: string | null;
  reference: string | null;
  position_title: string | null;
  match_id: string | null;
  file_id: string | null;
  filename: string | null;
  /** How many identical retry uploads this person made. */
  upload_attempts: number;
  first_seen: string;
  reason: GapReason;
  /** Deep link to the record a person should open to act. */
  link_path: string | null;
};

export type EvidenceGapSummary = {
  rows: EvidenceGapRow[];
  total_candidates_seen: number;
  total_with_evidence: number;
  total_gaps: number;
  /** Gaps caused by our own unfinished steps, not by the candidate. */
  our_fault: number;
  /** Gaps where the candidate was left with a message that hid the cause. */
  misinformed: number;
  by_reason: { code: string; label: string; count: number; our_fault: boolean }[];
};

function ref6(id: string) {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

const PARSED_STATES = new Set(["parsed", "reviewed_offline"]);
const FAILED_STATES = new Set(["failed", "review_required"]);

export const listEvidenceGaps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ include_test: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<EvidenceGapSummary> => {
    const { requireStaff } = await import("@/lib/admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const excludeTest = !data.include_test;

    const notTest = (q: Any) =>
      excludeTest ? q.or("is_test_record.is.null,is_test_record.eq.false") : q;

    const [appRes, matchRes, evRes, fileRes, profRes, posRes, qRes] = await Promise.all([
      notTest(
        supabaseAdmin
          .from("applications")
          .select("id,candidate_profile_id,position_id,cv_file_id,status,created_at,is_test_record")
          .order("created_at", { ascending: false })
          .limit(2000),
      ),
      supabaseAdmin
        .from("candidate_matches")
        .select("id,application_id,candidate_profile_id,position_id,processing_state")
        .limit(4000),
      supabaseAdmin.from("candidate_evidence").select("id,candidate_match_id,extracted").limit(4000),
      notTest(
        supabaseAdmin
          .from("files")
          .select(
            "id,candidate_profile_id,filename,checksum,parse_state,parse_error_code,created_at,upload_source,is_test_record",
          )
          .limit(4000),
      ),
      supabaseAdmin.from("candidate_profiles").select("id,full_name,email").limit(4000),
      supabaseAdmin.from("positions").select("id,title,requirements").limit(2000),
      supabaseAdmin.from("screening_questions").select("id,position_id").limit(4000),
    ]);

    const apps = (appRes.data ?? []) as Any[];
    const matches = (matchRes.data ?? []) as Any[];
    const evidence = (evRes.data ?? []) as Any[];
    const files = (fileRes.data ?? []) as Any[];
    const profiles = (profRes.data ?? []) as Any[];
    const positions = (posRes.data ?? []) as Any[];
    const questions = (qRes.data ?? []) as Any[];

    const matchByApp = new Map<string, Any>();
    for (const m of matches) if (m.application_id) matchByApp.set(m.application_id, m);

    const evidenceByMatch = new Map<string, Any>();
    for (const e of evidence) if (e.candidate_match_id) evidenceByMatch.set(e.candidate_match_id, e);

    const fileById = new Map<string, Any>(files.map((f) => [f.id, f]));
    const profById = new Map<string, Any>(profiles.map((p) => [p.id, p]));
    const posById = new Map<string, Any>(positions.map((p) => [p.id, p]));

    const questionCount = new Map<string, number>();
    for (const q of questions) {
      questionCount.set(q.position_id, (questionCount.get(q.position_id) ?? 0) + 1);
    }

    const filesByCp = new Map<string, Any[]>();
    for (const f of files) {
      if (!f.candidate_profile_id) continue;
      const list = filesByCp.get(f.candidate_profile_id) ?? [];
      list.push(f);
      filesByCp.set(f.candidate_profile_id, list);
    }

    const rows: EvidenceGapRow[] = [];
    let withEvidence = 0;

    // ---- Pass 1: applications that reached us but carry no evidence.
    for (const a of apps) {
      const prof = profById.get(a.candidate_profile_id);
      const pos = posById.get(a.position_id);
      const match = matchByApp.get(a.id);
      const ev = match ? evidenceByMatch.get(match.id) : null;
      const file = a.cv_file_id ? fileById.get(a.cv_file_id) : null;

      const extracted = ev?.extracted;
      const hasFindings =
        !!ev &&
        !!extracted &&
        typeof extracted === "object" &&
        Object.keys(extracted as Record<string, unknown>).length > 0;
      if (hasFindings) {
        withEvidence += 1;
        continue;
      }

      const requirementCount = Array.isArray(pos?.requirements) ? pos.requirements.length : 0;
      const screeningCount = questionCount.get(a.position_id) ?? 0;

      let code: string;
      if (!match) code = "application_without_match";
      else if (!a.cv_file_id || !file) code = "no_cv_supplied";
      else if (FAILED_STATES.has(String(file.parse_state))) code = "cv_unreadable";
      else if (!PARSED_STATES.has(String(file.parse_state))) code = "cv_never_parsed";
      else if (requirementCount === 0 && screeningCount === 0) code = "no_requirements_to_match";
      else if (ev) code = "evidence_row_empty";
      else code = "parsed_but_never_scored";

      rows.push({
        key: `app:${a.id}`,
        candidate_profile_id: a.candidate_profile_id ?? null,
        candidate_name: prof?.full_name ?? null,
        candidate_email: prof?.email ?? null,
        application_id: a.id,
        reference: ref6(a.id),
        position_title: pos?.title ?? null,
        match_id: match?.id ?? null,
        file_id: file?.id ?? null,
        filename: file?.filename ?? null,
        upload_attempts: 1,
        first_seen: a.created_at,
        reason: resolveGapReason(code),
        link_path: match ? `/admin/candidates/${match.id}` : `/admin/candidates`,
      });
    }

    // ---- Pass 2: people whose CV reached us but who never became an application.
    // These are invisible everywhere else in the product: no application, no
    // pipeline record, no queue entry — they simply never arrive.
    for (const [cpId, cpFiles] of filesByCp) {
      const hasApp = apps.some((a) => a.candidate_profile_id === cpId);
      if (hasApp) continue;
      const applicationUploads = cpFiles.filter(
        (f) => (f.upload_source ?? "candidate_application") === "candidate_application",
      );
      if (applicationUploads.length === 0) continue;

      const prof = profById.get(cpId);
      const sorted = [...applicationUploads].sort((x, y) =>
        String(x.created_at).localeCompare(String(y.created_at)),
      );
      const first = sorted[0]!;
      const distinctDocuments = new Set(sorted.map((f) => f.checksum ?? f.id)).size;
      const code =
        sorted.length > 1 && distinctDocuments === 1
          ? "duplicate_orphan_upload"
          : "upload_without_application";

      rows.push({
        key: `orphan:${cpId}`,
        candidate_profile_id: cpId,
        candidate_name: prof?.full_name ?? null,
        candidate_email: prof?.email ?? null,
        application_id: null,
        reference: null,
        position_title: null,
        match_id: null,
        file_id: first.id,
        filename: first.filename ?? null,
        upload_attempts: sorted.length,
        first_seen: first.created_at,
        reason: resolveGapReason(code),
        link_path: null,
      });
    }

    rows.sort((x, y) => String(y.first_seen).localeCompare(String(x.first_seen)));

    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.reason.code, (counts.get(r.reason.code) ?? 0) + 1);

    return {
      rows,
      total_candidates_seen: withEvidence + rows.length,
      total_with_evidence: withEvidence,
      total_gaps: rows.length,
      our_fault: rows.filter((r) => r.reason.ourFault).length,
      misinformed: rows.filter((r) => r.reason.candidateWasTold !== "specific").length,
      by_reason: [...counts.entries()]
        .map(([code, count]) => ({
          code,
          label: GAP_REASONS[code]?.label ?? code,
          count,
          our_fault: GAP_REASONS[code]?.ourFault ?? true,
        }))
        .sort((a, b) => b.count - a.count),
    };
  });
