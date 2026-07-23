// Canonical Client KPI service — the ONE definition of every client-facing
// count. Every dashboard tile, per-position roll-up, and drill-through filters
// the SAME rows with the SAME predicates, so counts always reconcile.
//
// Server-only: consumed by createServerFn handlers via the authenticated
// supabase client (RLS applies as the caller).
import {
  buildRequirementRows,
  summariseCoverage,
  buildInterviewGuide,
  toFitPresentation,
  prettifyHeadline,
  type RequirementRow,
  type CoverageSummary,
  type InterviewQuestion,
  type FitPresentation,
} from "@/lib/client-fit-presentation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;


export type MatchStage =
  | "delivered"
  | "shortlisted"
  | "interview_process"
  | "offer"
  | "hired"
  | "not_moving_forward";

export const TOP_FIT_LABELS = ["excellent", "strong"] as const;

export type KpiRow = {
  id: string;
  candidate_profile_id: string;
  position_id: string;
  stage: MatchStage;
  approved_score_run_id: string | null;
  delivered_at: string | null;
  approved_score: number | null;
  approved_fit_label: string | null;
  interview_active: boolean;
  interview_scheduled: boolean;
};


export type ClientKpis = {
  delivered: number;
  top: number;
  shortlisted: number;
  interviewing: number;
  interview_scheduled: number;
  hires: number;
  active_positions: number;
};

/**
 * Load the base rows used by every KPI + drill-through. Only visible matches;
 * RLS also enforces this for viewers, but we filter explicitly so counts match
 * exactly what the client sees.
 */
export async function loadKpiRows(
  supabase: AnyRow,
  orgId: string,
): Promise<KpiRow[]> {
  const { data: matches, error } = await supabase
    .from("candidate_matches")
    .select(
      `id, candidate_profile_id, position_id, stage, approved_score_run_id, delivered_at,
       score_runs:approved_score_run_id (score, fit_label)`,
    )
    .eq("organization_id", orgId)
    .eq("client_visibility", "visible");
  if (error) throw new Error(error.message);

  const matchIds = (matches as AnyRow[]).map((m) => m.id);
  const activeInterviews = new Set<string>();
  const scheduledInterviews = new Set<string>();
  if (matchIds.length > 0) {
    const { data: ivs } = await supabase
      .from("interviews")
      .select("candidate_match_id, status")
      .in("candidate_match_id", matchIds)
      .in("status", ["requested", "scheduling", "scheduled", "completed"]);
    for (const iv of (ivs as AnyRow[]) ?? []) {
      activeInterviews.add(iv.candidate_match_id);
      if (iv.status === "scheduled") scheduledInterviews.add(iv.candidate_match_id);
    }
  }

  return (matches as AnyRow[]).map((m) => ({
    id: m.id,
    candidate_profile_id: m.candidate_profile_id,
    position_id: m.position_id,
    stage: m.stage,
    approved_score_run_id: m.approved_score_run_id,
    delivered_at: m.delivered_at,
    approved_score: m.score_runs?.score ?? null,
    approved_fit_label: m.score_runs?.fit_label ?? null,
    interview_active: activeInterviews.has(m.id),
    interview_scheduled: scheduledInterviews.has(m.id),
  }));
}

export function isTopMatch(r: KpiRow): boolean {
  return (
    r.approved_score_run_id != null &&
    r.approved_fit_label != null &&
    (TOP_FIT_LABELS as readonly string[]).includes(r.approved_fit_label)
  );
}

export function isInInterview(r: KpiRow): boolean {
  return (
    r.stage === "interview_process" ||
    r.stage === "offer" ||
    r.interview_active
  );
}

export function computeKpis(rows: KpiRow[], activePositions = 0): ClientKpis {
  return {
    delivered: new Set(rows.map((r) => r.candidate_profile_id)).size,
    top: rows.filter(isTopMatch).length,
    shortlisted: rows.filter((r) => r.stage === "shortlisted").length,
    interviewing: rows.filter(isInInterview).length,
    interview_scheduled: rows.filter((r) => r.interview_scheduled).length,
    hires: rows.filter((r) => r.stage === "hired").length,
    active_positions: activePositions,
  };
}


/**
 * Canonical client-safe candidate DTO. Drops PII (email, phone, last name),
 * internal identifiers (application_id, trace_id, admin_status), and raw
 * scoring internals (contradiction status, raw evidence with metadata).
 * Exposes only the fields the presentation contract permits.
 */
export type ClientCandidateDTO = {
  match_id: string;
  stage: MatchStage;
  delivered_at: string | null;
  position: { id: string; title: string } | null;
  candidate: {
    display_name: string; // first name + last initial
    location: string | null;
    headline: string | null;
    availability: string | null;
    years_experience: number | null;
    summary: string | null;
  };
  score: number | null;
  fit_label: string | null;
  summary: string | null;
  strengths: string[];
  main_consideration: string | null;
  evidence: Array<{ label: string; snippet: string }>;
  experience: Array<{ title: string; company: string | null; period: string | null; description: string | null }>;
  skills: string[];
  education: Array<{ degree: string | null; institution: string | null; period: string | null }>;
  languages: Array<{ name: string; level: string | null }>;
  work_authorization: string | null;
  screening_answers: Array<{ question: string; answer: string }>;
};

function normStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normExperience(raw: unknown): ClientCandidateDTO["experience"] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((e: AnyRow) => ({
    title: String(e?.title ?? e?.role ?? "Role"),
    company: normStr(e?.company ?? e?.employer),
    period: normStr(e?.period ?? e?.dates ?? e?.duration ??
      [e?.start_date, e?.end_date ?? "Present"].filter(Boolean).join(" – ")),
    description: normStr(e?.description ?? e?.summary),
  }));
}

function normSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.slice(0, 20).map((s) => (typeof s === "string" ? s : (s?.name ?? String(s)))).filter(Boolean);
  }
  return [];
}

function normEducation(raw: unknown): ClientCandidateDTO["education"] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 6).map((e: AnyRow) => ({
    degree: normStr(e?.degree ?? e?.qualification ?? e?.title),
    institution: normStr(e?.institution ?? e?.school ?? e?.university),
    period: normStr(e?.period ?? e?.year ??
      [e?.start_date, e?.end_date].filter(Boolean).join(" – ")),
  }));
}

function normLanguages(raw: unknown): ClientCandidateDTO["languages"] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((l: AnyRow) => ({
    name: String(l?.name ?? l?.language ?? l),
    level: normStr(l?.level ?? l?.proficiency),
  })).filter((l) => l.name);
}

function normWorkAuth(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  const r = raw as AnyRow;
  return normStr(r?.status ?? r?.summary ?? r?.value);
}

function normScreeningAnswers(raw: unknown): ClientCandidateDTO["screening_answers"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: AnyRow) => {
    const q = a?.screening_questions?.question ?? a?.question ?? "";
    const ans = a?.answer;
    let text = "";
    if (ans == null) text = "";
    else if (typeof ans === "string") text = ans;
    else if (typeof ans === "boolean") text = ans ? "Yes" : "No";
    else if (typeof ans === "number") text = String(ans);
    else if (Array.isArray(ans)) text = ans.join(", ");
    else text = ans?.value ?? ans?.text ?? JSON.stringify(ans);
    return { question: String(q), answer: String(text) };
  }).filter((a) => a.question);
}

export function toClientCandidateDTO(row: AnyRow): ClientCandidateDTO {
  const cp = row.candidate_profiles ?? {};
  const pos = row.positions ?? null;
  const run = row.score_runs ?? null;
  const coverage = run?.requirement_coverage ?? null;

  const fullName: string = cp.full_name ?? "Candidate";
  const parts = fullName.trim().split(/\s+/);
  const displayName =
    parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : (parts[0] ?? "Candidate");

  const availability = (() => {
    const av = cp.availability;
    if (!av) return null;
    if (typeof av === "string") return av;
    return av.status ?? av.value ?? null;
  })();

  const runStrengths = run?.strengths ?? run?.result?.strengths;
  const runConcerns = run?.concerns ?? run?.result?.concerns;
  const strengths: string[] = Array.isArray(runStrengths)
    ? runStrengths.slice(0, 5).map(String)
    : Array.isArray(coverage?.matched)
      ? coverage.matched.slice(0, 5).map(String)
      : [];

  const mainConsideration: string | null =
    coverage?.main_consideration ??
    coverage?.gap ??
    (Array.isArray(coverage?.missing) && coverage.missing.length > 0
      ? String(coverage.missing[0])
      : null) ??
    (Array.isArray(runConcerns) && runConcerns.length > 0
      ? String(runConcerns[0])
      : null);

  const evidence: Array<{ label: string; snippet: string }> = Array.isArray(
    run?.evidence,
  )
    ? run.evidence.slice(0, 8).map((e: AnyRow) => ({
        label: String(e.label ?? e.type ?? "Evidence"),
        snippet: String(e.snippet ?? e.value ?? ""),
      }))
    : [];

  return {
    match_id: row.id,
    stage: row.stage,
    delivered_at: row.delivered_at ?? null,
    position: pos ? { id: pos.id, title: pos.title } : null,
    candidate: {
      display_name: displayName,
      location: cp.location ?? null,
      headline: cp.headline ?? null,
      availability,
      years_experience: cp.years_experience ?? null,
      summary: cp.summary ?? null,
    },
    score: run?.score ?? null,
    fit_label: run?.fit_label ?? null,
    summary: run?.explanation ?? null,
    strengths,
    main_consideration: mainConsideration,
    evidence,
    experience: normExperience(cp.experience),
    skills: normSkills(cp.skills),
    education: normEducation(cp.education),
    languages: normLanguages(cp.languages),
    work_authorization: normWorkAuth(cp.work_authorization),
    screening_answers: normScreeningAnswers(row.application_answers),
  };
}

