// Canonical Client KPI service — the ONE definition of every client-facing
// count. Every dashboard tile, per-position roll-up, and drill-through filters
// the SAME rows with the SAME predicates, so counts always reconcile.
//
// Server-only: consumed by createServerFn handlers via the authenticated
// supabase client (RLS applies as the caller).

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
};

export type ClientKpis = {
  delivered: number;
  top: number;
  shortlisted: number;
  interviewing: number;
  hires: number;
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
  if (matchIds.length > 0) {
    const { data: ivs } = await supabase
      .from("interviews")
      .select("candidate_match_id, status")
      .in("candidate_match_id", matchIds)
      .in("status", ["requested", "scheduling", "scheduled", "completed"]);
    for (const iv of (ivs as AnyRow[]) ?? [])
      activeInterviews.add(iv.candidate_match_id);
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

export function computeKpis(rows: KpiRow[]): ClientKpis {
  return {
    delivered: new Set(rows.map((r) => r.candidate_profile_id)).size,
    top: rows.filter(isTopMatch).length,
    shortlisted: rows.filter((r) => r.stage === "shortlisted").length,
    interviewing: rows.filter(isInInterview).length,
    hires: rows.filter((r) => r.stage === "hired").length,
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
  };
  score: number | null;
  fit_label: string | null;
  summary: string | null;
  strengths: string[];
  main_consideration: string | null;
  evidence: Array<{ label: string; snippet: string }>;
};

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

  const strengths: string[] = Array.isArray(run?.strengths)
    ? run.strengths.slice(0, 5).map(String)
    : Array.isArray(coverage?.matched)
      ? coverage.matched.slice(0, 5).map(String)
      : [];

  const mainConsideration: string | null =
    coverage?.main_consideration ??
    coverage?.gap ??
    (Array.isArray(coverage?.missing) ? (coverage.missing[0] ?? null) : null) ??
    (Array.isArray(run?.concerns) ? (run.concerns[0] ?? null) : null);

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
    },
    score: run?.score ?? null,
    fit_label: run?.fit_label ?? null,
    summary: run?.explanation ?? null,
    strengths,
    main_consideration: mainConsideration,
    evidence,
  };
}
