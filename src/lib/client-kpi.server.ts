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
  offers: number;
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
    offers: rows.filter((r) => r.stage === "offer").length,
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
  last_updated: string | null;
  position: { id: string; title: string } | null;
  candidate: {
    display_name: string; // first name + last initial
    location: string | null;
    timezone: string | null;
    headline: string | null;
    headline_chips: string[];
    availability: string | null;
    years_experience: number | null;
    summary: string | null;
    current_role: string | null;
    current_company: string | null;
    links: {
      linkedin: string | null;
      portfolio: string | null;
      github: string | null;
      website: string | null;
    };
  };
  score: number | null;
  fit_label: string | null;
  fit: FitPresentation;
  summary: string | null;
  strengths: string[];
  concerns: string[];
  main_consideration: string | null;
  requirement_rows: RequirementRow[];
  coverage: CoverageSummary;
  interview_guide: InterviewQuestion[];
  evidence: Array<{ label: string; snippet: string }>;
  experience: Array<{ title: string; company: string | null; period: string | null; description: string | null }>;
  skills: string[];
  education: Array<{ degree: string | null; institution: string | null; period: string | null }>;
  languages: Array<{ name: string; level: string | null }>;
  certifications: Array<{ name: string; issuer: string | null; date: string | null }>;
  work_authorization: string | null;
  screening_answers: Array<{ question: string; answer: string }>;
  compensation_alignment: {
    role_range: string | null;
    candidate_expectation: string | null;
    currency: string | null;
    cadence: string | null;
    verdict: "aligned" | "over" | "under" | "unknown";
    note: string | null;
  };
  source_trace: {
    source_label: string | null;
    applied_at: string | null;
    application_reference: string | null;
    channel: string | null;
    notes: string | null;
  };
  audit_trail: Array<{
    id: string;
    action: string;
    entity_type: string;
    actor: string | null;
    at: string;
    summary: string | null;
  }>;
  evaluation: {
    engine_version: string | null;
    blueprint_version: string | null;
    contradiction: string | null;
    completed_at: string | null;
    category_breakdown: Array<{ label: string; value: number | null; weight: number | null }>;
  };
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

function formatMoney(v: unknown, currency?: string | null): string | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return typeof v === "string" && v.trim().length ? v.trim() : null;
  const cur = (currency ?? "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${cur} ${Math.round(n).toLocaleString()}`;
  }
}

function normCompensationRange(raw: unknown): {
  role_range: string | null;
  currency: string | null;
  cadence: string | null;
  min: number | null;
  max: number | null;
} {
  if (!raw || typeof raw !== "object") {
    return { role_range: null, currency: null, cadence: null, min: null, max: null };
  }
  const r = raw as AnyRow;
  const currency = normStr(r.currency) ?? "USD";
  const cadence = normStr(r.cadence ?? r.period ?? r.frequency) ?? "annual";
  const toNum = (v: unknown) => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const min = toNum(r.min ?? r.min_amount ?? r.minimum ?? r.low);
  const max = toNum(r.max ?? r.max_amount ?? r.maximum ?? r.high);
  let role_range: string | null = null;
  if (min != null && max != null) role_range = `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  else if (min != null) role_range = `From ${formatMoney(min, currency)}`;
  else if (max != null) role_range = `Up to ${formatMoney(max, currency)}`;
  else if (typeof r.display === "string") role_range = r.display;
  return { role_range, currency, cadence, min, max };
}

function normCandidateExpectation(raw: unknown): { text: string | null; amount: number | null; currency: string | null } {
  if (!raw) return { text: null, amount: null, currency: null };
  if (typeof raw === "string") return { text: raw.trim() || null, amount: null, currency: null };
  const r = raw as AnyRow;
  const currency = normStr(r.currency) ?? null;
  const toNum = (v: unknown) => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const target = toNum(r.target ?? r.expected ?? r.amount ?? r.value ?? r.min ?? r.desired);
  const explicit = normStr(r.display ?? r.summary ?? r.note ?? r.text);
  const text =
    explicit ?? (target != null ? (formatMoney(target, currency) ?? String(target)) : null);
  return { text, amount: target, currency };
}

function classifyCompensation(
  role: { min: number | null; max: number | null },
  cand: { amount: number | null },
): "aligned" | "over" | "under" | "unknown" {
  if (cand.amount == null || (role.min == null && role.max == null)) return "unknown";
  const a = cand.amount;
  const lo = role.min ?? -Infinity;
  const hi = role.max ?? Infinity;
  if (a < lo * 0.95) return "under";
  if (a > hi * 1.05) return "over";
  return "aligned";
}

function normSourceLabel(source: unknown): { label: string | null; channel: string | null } {
  const s = normStr(source);
  if (!s) return { label: null, channel: null };
  const key = s.toLowerCase();
  const map: Record<string, string> = {
    job_board: "Job board",
    website: "TaaSFlow job board",
    referral: "Referral",
    outreach: "TaaSFlow outreach",
    talent_memory: "Talent memory",
    partner: "Partner network",
    direct: "Direct application",
    linkedin: "LinkedIn",
  };
  return { label: map[key] ?? s.replace(/_/g, " "), channel: s };
}

function buildAuditTrail(rows: unknown): ClientCandidateDTO["audit_trail"] {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).map((e: AnyRow) => {
    const action = String(e.action ?? "event");
    const entity = String(e.entity_type ?? "");
    const before = e.before_state ?? null;
    const after = e.after_state ?? null;
    let summary: string | null = null;
    if (after && typeof after === "object" && "stage" in after) {
      summary = before && typeof before === "object" && "stage" in before
        ? `${(before as AnyRow).stage} → ${(after as AnyRow).stage}`
        : `Set to ${(after as AnyRow).stage}`;
    }
    return {
      id: String(e.id),
      action,
      entity_type: entity,
      actor: normStr(e.actor_user_id),
      at: String(e.created_at ?? new Date().toISOString()),
      summary,
    };
  });
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

  const experience = normExperience(cp.experience);
  const currentRole = experience[0]?.title ?? null;
  const currentCompany = experience[0]?.company ?? null;

  const certifications = Array.isArray(cp.certifications)
    ? (cp.certifications as AnyRow[]).slice(0, 8).map((c) => ({
        name: String(c?.name ?? c?.title ?? ""),
        issuer: normStr(c?.issuer ?? c?.organization ?? c?.authority),
        date: normStr(c?.date ?? c?.issued ?? c?.year),
      })).filter((c) => c.name)
    : [];

  const isHttp = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    return /^https?:\/\/[^\s]+$/i.test(s) ? s : null;
  };
  const links = {
    linkedin: isHttp(cp.linkedin_url),
    portfolio: isHttp(cp.portfolio_url),
    github: isHttp((cp as AnyRow).github_url),
    website: isHttp((cp as AnyRow).website_url ?? (cp as AnyRow).website),
  };

  const { headline: prettyHeadline, chips } = prettifyHeadline(cp.headline ?? null);

  const concerns: string[] = Array.isArray(runConcerns)
    ? runConcerns.slice(0, 5).map(String)
    : Array.isArray(coverage?.missing)
      ? coverage.missing.slice(0, 5).map(String)
      : [];

  const requirement_rows = buildRequirementRows(
    pos ? { requirements: pos.requirements, preferred_requirements: pos.preferred_requirements } : null,
    coverage,
  );
  const coverageSummary = summariseCoverage(requirement_rows);

  const workAuth = normWorkAuth(cp.work_authorization);
  const interview_guide = buildInterviewGuide({
    positionTitle: pos?.title ?? null,
    rows: requirement_rows,
    strengths,
    concerns,
    availability,
    workAuth,
  });

  const fit = toFitPresentation(run?.fit_label ?? null, run?.score ?? null);

  const roleComp = normCompensationRange(pos?.compensation);
  const candExpect = normCandidateExpectation(cp.compensation_preferences);
  const verdict = classifyCompensation(roleComp, candExpect);
  const compNote =
    verdict === "aligned"
      ? "Candidate expectation sits inside the approved role range."
      : verdict === "over"
        ? "Candidate expectation exceeds the current range — negotiate or re-scope."
        : verdict === "under"
          ? "Candidate expectation is below range — validate before making an offer."
          : candExpect.text
            ? "Range not published for this role — confirm alignment directly."
            : "Candidate has not shared an expectation yet.";

  const app = (row as AnyRow).applications ?? null;
  const source = normSourceLabel(app?.source);
  const source_trace: ClientCandidateDTO["source_trace"] = {
    source_label: source.label,
    applied_at: app?.applied_at ?? app?.created_at ?? null,
    application_reference: app?.reference_code ?? null,
    channel: source.channel,
    notes: null,
  };

  const audit_trail = buildAuditTrail((row as AnyRow).audit_events);

  return {
    match_id: row.id,
    stage: row.stage,
    delivered_at: row.delivered_at ?? null,
    last_updated: run?.completed_at ?? row.updated_at ?? row.delivered_at ?? null,
    position: pos ? { id: pos.id, title: pos.title } : null,
    candidate: {
      display_name: displayName,
      location: cp.location ?? null,
      timezone: cp.timezone ?? null,
      headline: prettyHeadline,
      headline_chips: chips,
      availability,
      years_experience: cp.years_experience ?? null,
      summary: cp.summary ?? null,
      current_role: currentRole,
      current_company: currentCompany,
      links,
    },
    score: run?.score ?? null,
    fit_label: run?.fit_label ?? null,
    fit,
    summary: run?.explanation ?? null,
    strengths,
    concerns,
    main_consideration: mainConsideration,
    requirement_rows,
    coverage: coverageSummary,
    interview_guide,
    evidence,
    experience,
    skills: normSkills(cp.skills),
    education: normEducation(cp.education),
    languages: normLanguages(cp.languages),
    certifications,
    work_authorization: workAuth,
    screening_answers: normScreeningAnswers(row.application_answers),
    compensation_alignment: {
      role_range: roleComp.role_range,
      candidate_expectation: candExpect.text,
      currency: roleComp.currency ?? candExpect.currency,
      cadence: roleComp.cadence,
      verdict,
      note: compNote,
    },
    source_trace,
    audit_trail,
  };
}


