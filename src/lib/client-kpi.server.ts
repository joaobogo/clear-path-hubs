// Canonical Client KPI service — the ONE definition of every client-facing
// count. Every dashboard tile, per-position roll-up, and drill-through filters
// the SAME rows with the SAME predicates, so counts always reconcile.
//
// Server-only: consumed by createServerFn handlers via the authenticated
// supabase client (RLS applies as the caller).
import { isUnicornMatch, classifyBand, bandToFitLabel } from "@/lib/scoring/bands";
import { displayScore } from "@/config/scoring-bands";

import { countLanes, isInLane, rowsInLane } from "@/lib/client-pipeline-lane";
import { cleanQuote, isTemplatedEvidence, isCandidateHeadline } from "@/lib/evidence/quote-hygiene";

import {
  buildRequirementRows,
  summariseCoverage,
  evidenceSupport,
  buildInterviewGuide,
  toFitPresentation,
  prettifyHeadline,
  type RequirementRow,
  type CoverageSummary,
  type InterviewQuestion,
  type FitPresentation,
} from "@/lib/client-fit-presentation";
import { clientReviewStatement } from "@/lib/scoring/human-adjustment";
import {
  clientMethodLabel,
  normalizeEvaluationMethod,
  type EvaluationMethod,
} from "@/lib/scoring/evaluation-method";
import {
  buildScoreExplanation,
  type ScoreExplanation,
} from "@/lib/scoring/score-explanation";
import {
  buildEvidenceCard,
  type EvidenceCard,
  type ClientEvidenceRow,
} from "@/lib/client-evidence-card";
import { assessFreshness, mergeStoredStaleness, type Freshness } from "@/lib/scoring/score-freshness";
import { CALIBRATION_VERSION } from "@/lib/scoring/engine-calibration";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import { buildReviewTimeline, type ReviewTimeline } from "@/lib/client/review-timeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;


export type MatchStage =
  | "delivered"
  | "shortlisted"
  | "interview_process"
  | "offer"
  | "hired"
  | "not_moving_forward";

/**
 * Every stored word that means "top of the pile", across both vocabularies in
 * play: the engine's `fit_label` (`strong_fit`) and the canonical band keys
 * (`exceptional` / `top` / `strong`). The historical list here was
 * `["excellent","strong"]`, which no writer ever produces — so the "Strongest
 * candidates" figure counted zero forever. Band thresholds stay in
 * `scoring/bands.ts`; this is only the label vocabulary.
 */
export const TOP_FIT_LABELS = [
  "strong_fit",
  "exceptional",
  "top",
  "excellent",
] as const;

export type KpiRow = {
  id: string;
  candidate_profile_id: string;
  position_id: string;
  stage: MatchStage;
  approved_score_run_id: string | null;
  delivered_at: string | null;
  approved_score: number | null;
  approved_fit_label: string | null;
  /** Stored band key of the approved run, when the writer recorded one. */
  approved_fit_band: string | null;
  interview_active: boolean;
  interview_scheduled: boolean;
  /** An interview exists that still needs the client to confirm a time. */
  interview_needs_confirmation: boolean;
  /** The interview record that needs confirmation, when one exists. */
  interview_id: string | null;
  /** Soonest confirmed interview time, if one is booked. */
  next_interview_at: string | null;
  /** When the earliest unconfirmed interview was requested. */
  interview_requested_at: string | null;
  /** When this candidate entered its current stage (falls back to delivery). */
  stage_entered_at: string | null;
  /** Recorded date the client's decision is due by, when one is stored. */
  client_decision_due_at: string | null;
  /** The client's recorded decision, or null/"pending" when none was made. */
  recommendation: string | null;
  /** True when a `client_decisions` row exists for this match. */
  client_decided: boolean;
};





export type ClientKpis = {
  delivered: number;
  top: number;
  shortlisted: number;
  interviewing: number;
  interview_scheduled: number;
  /** Interviews requested or being scheduled — waiting on the client. */
  interviews_to_confirm: number;
  /** Candidates delivered and still awaiting a first client decision. */
  awaiting_decision: number;
  /** Oldest timestamps behind each queue count — makes delay visible. */
  oldest_awaiting_decision_at: string | null;
  oldest_interview_to_confirm_at: string | null;
  oldest_offer_at: string | null;
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
       client_decision_due_at, recommendation, contact_released_at,
       score_runs:approved_score_run_id (score, fit_label, fit_band),
       organizations!inner(name)`
    )
    .eq("organization_id", orgId)
    .eq("client_visibility", "visible")
    .eq("is_test_record" as any, false);
  if (error) throw new Error(error.message);

  const matchIds = (matches as AnyRow[]).map((m) => m.id);
  const activeInterviews = new Set<string>();
  const scheduledInterviews = new Set<string>();
  const unconfirmedInterviews = new Set<string>();
  const unconfirmedInterviewId = new Map<string, string>();
  const nextInterviewAt = new Map<string, string>();
  const interviewRequestedAt = new Map<string, string>();
  const stageEnteredAt = new Map<string, string>();
  // A recorded client decision is what closes "waiting on you" — never the
  // internal admin recommendation.
  const decidedMatches = new Set<string>();
  let evidenceByMatch = new Map<string, ClientEvidenceRow[]>();


  if (matchIds.length > 0) {
    const { data: ivs } = await supabase
      .from("interviews")
      .select("id, candidate_match_id, status, scheduled_at, created_at")
      .in("candidate_match_id", matchIds)
      .in("status", ["requested", "scheduling", "scheduled", "completed"]);
    for (const iv of (ivs as AnyRow[]) ?? []) {
      activeInterviews.add(iv.candidate_match_id);
      if (iv.status === "scheduled") {
        scheduledInterviews.add(iv.candidate_match_id);
        const at = iv.scheduled_at as string | null;
        if (at) {
          const prev = nextInterviewAt.get(iv.candidate_match_id);
          if (!prev || at < prev) nextInterviewAt.set(iv.candidate_match_id, at);
        }
      }
      if (iv.status === "requested" || iv.status === "scheduling") {
        unconfirmedInterviews.add(iv.candidate_match_id);
        const at = iv.created_at as string | null;
        if (at) {
          const prev = interviewRequestedAt.get(iv.candidate_match_id);
          if (!prev || at < prev) interviewRequestedAt.set(iv.candidate_match_id, at);
        }
        // Keep the earliest open interview so deep links point to the right record.
        if (!unconfirmedInterviewId.has(iv.candidate_match_id)) {
          unconfirmedInterviewId.set(iv.candidate_match_id, iv.id as string);
        }
      }
    }

    // When each candidate entered its current stage — the clock clients see.
    const { data: history } = await supabase
      .from("candidate_stage_history")
      .select("candidate_match_id, to_stage, created_at")
      .in("candidate_match_id", matchIds);
    const stageByMatch = new Map<string, string>(
      (matches as AnyRow[]).map((m) => [m.id as string, String(m.stage)]),
    );
    for (const h of ((history as AnyRow[]) ?? [])) {
      if (stageByMatch.get(h.candidate_match_id) !== h.to_stage) continue;
      const at = h.created_at as string | null;
      if (!at) continue;
      const prev = stageEnteredAt.get(h.candidate_match_id);
      if (!prev || at > prev) stageEnteredAt.set(h.candidate_match_id, at);
    }

    // Recorded client decisions — the only thing that clears a delivered
    // candidate out of "waiting on your decision".
    const { data: decisions } = await supabase
      .from("client_decisions")
      .select("candidate_match_id")
      .in("candidate_match_id", matchIds);
    for (const d of ((decisions as AnyRow[]) ?? [])) {
      if (d.candidate_match_id) decidedMatches.add(d.candidate_match_id as string);
    }

    // Client-visible evidence comes from the one canonical read model
    // (`candidate_evidence_client`), not a nested embed — candidate_matches has
    // no direct relationship to the evidence tables, so the embed failed the
    // whole KPI read and every page built on it.
    evidenceByMatch = await loadClientEvidenceItems(supabase, matchIds);
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
    organization_name: m.organizations?.name ?? null,
    approved_fit_band: m.score_runs?.fit_band ?? null,
    interview_active: activeInterviews.has(m.id),
    interview_scheduled: scheduledInterviews.has(m.id),
    next_interview_at: nextInterviewAt.get(m.id) ?? null,
    interview_requested_at: interviewRequestedAt.get(m.id) ?? null,
    stage_entered_at: stageEnteredAt.get(m.id) ?? m.delivered_at ?? null,

    client_decision_due_at: m.client_decision_due_at ?? null,
    recommendation: m.recommendation ?? null,
    contact_released_at: m.contact_released_at ?? null,
    client_decided: decidedMatches.has(m.id),
    interview_needs_confirmation: unconfirmedInterviews.has(m.id),
    interview_id: unconfirmedInterviewId.get(m.id) ?? null,
    evidence_items: (evidenceByMatch.get(String(m.id)) as unknown as AnyRow[]) ?? [],
  }));
}


/**
 * A "strongest candidate": the approved run's SCORE classifies into `exceptional`
 * through the canonical band table. Stored label/band strings are only
 * consulted for runs that never recorded a number.
 */
export function isTopMatch(r: KpiRow): boolean {
  if (r.approved_score_run_id == null) return false;
  const words = TOP_FIT_LABELS as readonly string[];
  if (r.approved_score != null) {
    const band = classifyBand(r.approved_score);
    // C9: Strong fit (70+) counts as 'top' for the "Strongest candidates" tile
    // to match the client-facing presentation logic.
    return band === "exceptional" || band === "top" || band === "strong";
  }
  if (r.approved_fit_label != null && words.includes(r.approved_fit_label)) return true;
  if (r.approved_fit_band != null && words.includes(r.approved_fit_band)) return true;
  return false;
}



/**
 * "In the interview lane" — delegated to the canonical lane derivation so this
 * tile can never disagree with the Kanban column that shows the same people.
 */
export function isInInterview(r: KpiRow): boolean {
  return isInLane(r, "interview_process");
}

/**
 * One definition of "waiting on the client": still sitting at `delivered` with
 * no `client_decisions` row recorded. The Overview queue, the "Your open items"
 * strip and the admin "Client decisions overdue" queue apply the same rule, so
 * the count and the lists can never disagree. The internal `recommendation`
 * column is our own recommendation, not the client's answer, so it is not used
 * here.
 */
export function isAwaitingClientDecision(r: KpiRow): boolean {
  return r.delivered_at != null && r.stage === "delivered" && !r.client_decided;
}



/** Earliest non-null timestamp in a list. */
function oldest(values: Array<string | null | undefined>): string | null {
  return values.filter((v): v is string => Boolean(v)).sort()[0] ?? null;
}

export function computeKpis(rows: KpiRow[], activePositions = 0): ClientKpis {
  // Every stage-shaped count comes from the one lane derivation, so the tiles,
  // the board columns and the per-role roll-ups are literally the same numbers.
  const { counts } = countLanes(rows);
  return {
    delivered: rows.length,
    top: rows.filter(isTopMatch).length,
    shortlisted: counts.shortlisted,
    interviewing: counts.interview_process,
    interview_scheduled: rows.filter((r) => r.stage === "interview_process" && r.interview_scheduled).length,
    interviews_to_confirm: rows.filter((r) => r.stage === "interview_process" && r.interview_needs_confirmation).length,

    awaiting_decision: rows.filter(isAwaitingClientDecision).length,
    offers: counts.offer,
    // Unified definition of hired across all surfaces: the stage is 'hired'.
    // We include 'filled' for historical parity where the stage was recorded differently.
    hires: (counts.hired || 0) + ((counts as any).filled || 0),
    active_positions: activePositions,
    oldest_awaiting_decision_at: oldest(
      rows
        .filter(isAwaitingClientDecision)
        .map((r) => r.delivered_at ?? r.stage_entered_at),
    ),
    oldest_interview_to_confirm_at: oldest(
      rows
        .filter((r) => r.interview_needs_confirmation)
        .map((r) => r.interview_requested_at ?? r.stage_entered_at),
    ),
    oldest_offer_at: oldest(
      rowsInLane(rows, "offer").map((r) => r.stage_entered_at),
    ),
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
  /**
   * An interview exists for this candidate (requested, scheduling, scheduled or
   * completed). The "Interviewing" KPI counts these regardless of stage, so the
   * list must be able to as well — filtering on stage alone made the tile and
   * its drill-through disagree.
   */
  interview_active: boolean;
  /**
   * Whether an admin has released this candidate's contact details to the
   * employer. The raw CV carries email and phone, so CV download/preview is
   * offered only when this is true — the server re-checks it regardless.
   */
  contact_released: boolean;
  /** When this candidate entered its current stage — powers the age badge. */
  stage_entered_at: string | null;
  last_updated: string | null;
  position: { id: string; title: string } | null;

  /**
   * True for a standout candidate: an approved score at or above the unicorn
   * threshold (95+). The threshold comes from the band configuration.
   */
  unicorn: boolean;
  /**
   * Whether the shown assessment still describes current facts. Computed from
   * the run's own stamps versus the profile, the brief, the criteria, and the
   * engine/calibration in force today. The visible result is never rewritten;
   * a stale one is flagged and a reassessment is offered.
   */
  freshness: Freshness;
  candidate: {
    full_name: string;
    display_name: string; // full name when known, else the anonymous placeholder
    email: string | null;
    phone: string | null;
    location: string | null;
    timezone: string | null;
    headline: string | null;
    headline_chips: string[];
    availability: string | null;
    years_experience: number | null;
    summary: string | null;
    current_role: string | null;
    current_company: string | null;
    organization_name: string | null;
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
  /**
   * Evidence support behind the band — what employer surfaces render next to
   * the band instead of a numeric score.
   */
  evidence_support: { supported: number; total: number };
  /**
   * A person reviewed this assessment by hand. Clients see the fact and the
   * count of hand-verified requirements — never the reviewer's internal note.
   */
  human_review: { reviewed: boolean; verified_requirements: number; statement: string | null };


  /**
   * The band is never a bare adjective: this names the method that produced the
   * assessment and lists the criteria with their evidence snippets. When no
   * criterion carries evidence the shape is `evidence_pending` and the surface
   * shows the band with "Evidence pending" instead of a figure.
   */
  explanation: ScoreExplanation;
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
  /** Verified, shareable evidence bullets for the shortlist card. */
  evidence_card: EvidenceCard;
  /** Compact review timeline: CV read → scored → reviewed → shared. */
  review_timeline: ReviewTimeline;
  evaluation: {
    engine_version: string | null;
    blueprint_version: string | null;
    contradiction: string | null;
    completed_at: string | null;
    /** Truthful method behind the run: never "hybrid". */
    method: EvaluationMethod;
    method_label: string;
    category_breakdown: Array<{ label: string; value: number | null; weight: number | null }>;
  };
};



function normStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normPeriod(
  start: unknown,
  end: unknown,
  rawPeriod: unknown,
): string | null {
  const p = normStr(rawPeriod);
  if (p) return p;
  const s = normStr(start);
  let e = normStr(end);
  if (!s) return null;
  if (!e || e.toLowerCase() === "present") e = "Present";
  return `${s} – ${e}`;
}

function normExperience(raw: unknown): ClientCandidateDTO["experience"] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((e: AnyRow) => ({
    title: String(e?.title ?? e?.role ?? "Role"),
    company: normStr(e?.company ?? e?.employer),
    period: normPeriod(e?.start ?? e?.start_date, e?.end ?? e?.end_date, e?.period ?? e?.dates ?? e?.duration),
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
    period: normPeriod(e?.start ?? e?.start_date, e?.end ?? e?.end_date, e?.period ?? e?.year),
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
  if (typeof raw === "string") {
    const clean = raw.trim();
    if (/TAASFLOW_DEMO_SEED/i.test(clean)) return null;
    return clean || null;
  }
  const r = raw as AnyRow;
  const notes = normStr(r?.notes);
  if (notes && /TAASFLOW_DEMO_SEED/i.test(notes)) {
    return normStr(r?.required ?? r?.summary ?? r?.value) ?? null;
  }
  return notes || normStr(r?.required ?? r?.summary ?? r?.value) || null;
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
    website: "Careers site",
    referral: "Referral",
    outreach: "Recruiter outreach",
    talent_memory: "Talent memory",
    partner: "Partner network",
    direct: "Direct application",
    linkedin: "LinkedIn",
  };
  return { label: map[key] ?? s.replace(/_/g, " "), channel: s };
}

function buildAuditTrail(rows: unknown): ClientCandidateDTO["audit_trail"] {
  if (!Array.isArray(rows)) return [];

  const WHITELIST: Record<string, string> = {
    delivered: "Delivered to you",
    shortlisted: "Shortlisted",
    interview_requested: "Interview requested",
    interview_scheduled: "Interview scheduled",
    interview_completed: "Interview completed",
    offer: "Offer made",
    hired: "Hired",
    decided: "Decision recorded",
    viewed: "Viewed by your team",
    downloaded: "CV downloaded by your team",
  };

  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((e: AnyRow) => {
      const action = String(e.action ?? "event");
      const before = e.before_state ?? null;
      const after = e.after_state ?? null;

      let safeAction: string | null = null;
      const normAction = action.toLowerCase();

      // 1. Map stage transitions (even if inside UPDATE)
      if (after && typeof after === "object" && "stage" in after) {
        const fromStage =
          before && typeof before === "object" && "stage" in before
            ? String((before as AnyRow).stage)
            : null;
        const toStage = String((after as AnyRow).stage);

        // Drop no-op transitions
        if (fromStage !== toStage) {
          if (toStage === "delivered") safeAction = WHITELIST.delivered;
          else if (toStage === "shortlisted") safeAction = WHITELIST.shortlisted;
          else if (toStage === "offer") safeAction = WHITELIST.offer;
          else if (toStage === "hired") safeAction = WHITELIST.hired;
        }
      }

      // 2. Map explicit action keys
      if (!safeAction) {
        if (normAction.includes("interview.scheduled")) safeAction = WHITELIST.interview_scheduled;
        else if (normAction.includes("interview.requested")) safeAction = WHITELIST.interview_requested;
        else if (normAction.includes("interview.completed")) safeAction = WHITELIST.interview_completed;
        else if (normAction.includes("decision.recorded")) safeAction = WHITELIST.decided;
        else if (normAction.includes("viewed")) safeAction = WHITELIST.viewed;
        else if (normAction.includes("cv.download") || normAction.includes("cv_download")) {
          // Client-initiated downloads only
          if (after && typeof after === "object" && (after as AnyRow).audience === "client") {
            safeAction = WHITELIST.downloaded;
          }
        }
      }

      if (!safeAction) return null;

      return {
        id: String(e.id),
        action: safeAction,
        entity_type: String(e.entity_type ?? "event"),
        actor: e.actor_user_id ? "Recruiting team" : "System",
        at: String(e.created_at ?? new Date().toISOString()),
        summary: null,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, 20);
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

/**
 * The exact row shape `toClientCandidateDTO` reads. Shared by the employer
 * detail view and the candidate's "what employers see" preview so the two can
 * never select different columns.
 */
export const CLIENT_CANDIDATE_SELECT = `id, stage, delivered_at, position_id, application_id, candidate_profile_id, contact_released_at, contact_released_by, contact_release_reason,
         canonical_state, processing_state, processing_updated_at, submitted_to_client_at,
         score_stale, score_stale_reasons, score_stale_at, rescore_queued_at,
         candidate_profiles(id, full_name, email, phone, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications, compensation_preferences, updated_at),
         positions(id, title, location, work_model, requirements, preferred_requirements, compensation, updated_at),
         applications(id, source, applied_at, created_at),
         score_runs:approved_score_run_id (score, fit_label, fit_band, result, evidence, requirement_coverage, completed_at, engine_version, evaluation_method, input_hash, blueprint_version, contradiction_status, must_have_coverage, preferred_coverage)`;


/** Lowest score inside the strongest configured band. Single source of truth. */


export function toClientCandidateDTO(row: AnyRow): ClientCandidateDTO {
  const cp = row.candidate_profiles ?? {};
  const pos = row.positions ?? null;
  const run = row.score_runs ?? null;
  const coverage = run?.requirement_coverage ?? null;

  const fullName: string = (cp.full_name ?? "").trim() || "Candidate";
  // Employers see the full name on any candidate that reached their workspace —
  // the delivery decision already happened upstream.
  const displayName = fullName;

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

  // Contact release is a separate permission, so every quote goes through the
  // same hygiene pass as the criteria rows before it leaves the server.
  // Generic template snippets (skills lists, profile summaries) are not evidence.
  const evidence: Array<{ label: string; snippet: string }> = Array.isArray(
    run?.evidence,
  )
    ? run.evidence
        .slice(0, 8)
        .map((e: AnyRow) => ({
          label: String(e.label ?? e.type ?? "Evidence"),
          snippet: cleanQuote(String(e.snippet ?? e.value ?? "")),
        }))
        .filter((e: { snippet: string }) => e.snippet.length > 0 && !isTemplatedEvidence(e.snippet) && !isCandidateHeadline(e.snippet))
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

  const fit = toFitPresentation(
    run?.fit_label ?? run?.fit_band ?? null,
    run?.score != null ? Number(run.score) : null,
  );

  const prettyHeadline = prettifyHeadline(cp.headline ?? null);

  const concerns: string[] = Array.isArray(runConcerns)
    ? runConcerns.slice(0, 5).map(String)
    : Array.isArray(coverage?.missing)
      ? coverage.missing.slice(0, 5).map(String)
      : [];

  const requirement_rows = buildRequirementRows(
    pos ? { requirements: pos.requirements, preferred_requirements: pos.preferred_requirements } : null,
    coverage,
    ((row as AnyRow).evidence_items as AnyRow[] | null) ?? null,
  );
  const coverageSummary = summariseCoverage(requirement_rows, fit, run?.score != null ? Number(run.score) : coverage?.fit_score ?? null);

  const workAuth = normWorkAuth(cp.work_authorization);
  const interview_guide = buildInterviewGuide({
    positionTitle: pos?.title ?? null,
    rows: requirement_rows,
    strengths,
    concerns,
    availability,
    workAuth,
  });


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

  // Method + criteria + evidence snippets. When no criterion carries a quoted
  // snippet, this comes back as `evidence_pending` and the surface shows the
  // band without a figure rather than an unsupported claim.
  const clientExplanation = buildScoreExplanation({
    audience: "client",
    method: (run as AnyRow)?.evaluation_method ?? null,
    score: run?.score != null ? Math.round(Number(run.score)) : null,
    bandLabel: fit.headline,
    evidencePath: { kind: "route", to: `/client/candidates/${row.id}#sec-coverage` },
    criteria: requirement_rows.map((r) => ({
      label: r.label,
      importance: r.importance === "must_have" ? "must_have" : "preferred",
      verdict:
        r.status === "met"
          ? "met"
          : r.status === "partial"
            ? "partial"
            : r.status === "not_applicable"
              ? "not_applicable"
              : r.status === "not_evidenced" || r.status === "contradicted"
                ? "missing"
                : "unknown",
      evidence_snippet: r.evidence?.[0]?.snippet ?? null,
      source: r.evidence?.[0]?.source ?? null,
    })),
  });


  // Contact release is now automatic at publish time. Any match that has
  // reached the client workspace (client_visibility = 'visible') carries a
  // contact_released_at timestamp; the client sees full name, email, phone and
  // CV from that moment with no extra consent step.
  const released = Boolean(row.contact_released_at);

  return {
    match_id: row.id,
    stage: row.stage,
    delivered_at: row.delivered_at ?? null,
    interview_active: Boolean(row.interview_active),
    contact_released: released,

    stage_entered_at:
      row.stage === "delivered"
        ? (row.delivered_at ?? row.updated_at ?? null)
        : (row.updated_at ?? row.delivered_at ?? null),
    last_updated: run?.completed_at ?? row.updated_at ?? row.delivered_at ?? null,
    position: pos ? { id: pos.id, title: pos.title } : null,
    candidate: {
      ...cp,
      full_name: fullName,
      display_name: displayName,
      email: released ? normStr(cp.email) : null,
      phone: released ? normStr(cp.phone) : null,
      location: normStr(cp.location),
      timezone: normStr(cp.timezone),
      headline: prettyHeadline,
      headline_chips: chips,
      availability,
      years_experience: Number(cp.years_experience) || null,
      summary: normStr(cp.summary),
      current_role: currentRole,
      current_company: currentCompany,
      organization_name: normStr(row.organizations?.name),
      links,
    },
    // Band comes from this run's score through the one band table. The stored
    // `fit_band` string uses the engine's label vocabulary, not band keys, so
    // feeding it here silently failed the top-band test.
    unicorn: isUnicornMatch({
      score: run?.score != null ? Number(run.score) : null,
      band: run?.score != null ? classifyBand(Number(run.score)) : null,
      hired: row.stage === "hired",
    }),

    freshness: mergeStoredStaleness(
      assessFreshness({
        scored_at: run?.completed_at ?? null,
        scored_input_hash: run?.input_hash ?? null,
        scored_engine_version: run?.engine_version ?? null,
        scored_calibration_version:
          (run?.result as AnyRow | null)?.calibration_version ?? null,
        current_engine_version: run?.engine_version ? ENGINE_VERSION : null,
        current_calibration_version: (run?.result as AnyRow | null)?.calibration_version
          ? CALIBRATION_VERSION
          : null,
        profile_updated_at: cp.updated_at ?? null,
        brief_updated_at: pos?.updated_at ?? null,
        criteria_updated_at: (row as AnyRow).criteria_updated_at ?? null,
      }),
      // Recorded invalidations from the database triggers — a client must never
      // see a superseded assessment presented as current.
      {
        score_stale: (row as AnyRow).score_stale ?? null,
        score_stale_reasons: (row as AnyRow).score_stale_reasons ?? null,
        score_stale_at: (row as AnyRow).score_stale_at ?? null,
        rescore_queued_at: (row as AnyRow).rescore_queued_at ?? null,
      },
    ),

    // candidate property already assigned above
    // Employers see the 0-100 fit score alongside the band so ranking is
    // obvious at a glance. 95+ is the unicorn threshold.
    score: run?.score != null ? displayScore(Number(run.score)) : null,
    fit_label: run?.fit_label ?? run?.fit_band ?? null,
    fit,
    summary: (run?.result as AnyRow)?.fit_rationale ?? (run?.result as AnyRow)?.summary ?? null,

    strengths,
    concerns,
    main_consideration: mainConsideration,
    requirement_rows,
    evidence_support: evidenceSupport(requirement_rows),
    human_review: (() => {
      const res = (run?.result as AnyRow | null) ?? null;
      const reviewed =
        (run as AnyRow)?.evaluation_method === "human_adjusted" ||
        Boolean(res?.human_adjustment);
      const verified = Number(res?.verified_evidence?.human_verified ?? 0);
      return {
        reviewed,
        verified_requirements: reviewed ? verified : 0,
        statement: clientReviewStatement({ humanAdjusted: reviewed, verifiedCount: verified }),
      };
    })(),
    explanation: clientExplanation,
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
    review_timeline: buildReviewTimeline({
      processing_state: (row as AnyRow).processing_state ?? null,
      canonical_state: (row as AnyRow).canonical_state ?? null,
      applied_at: source_trace.applied_at,
      processing_updated_at: (row as AnyRow).processing_updated_at ?? null,
      scored_at: run?.completed_at ?? null,
      human_reviewed:
        (run as AnyRow)?.evaluation_method === "human_adjusted" ||
        Boolean((run?.result as AnyRow | null)?.human_adjustment),
      published_at:
        row.delivered_at ?? (row as AnyRow).submitted_to_client_at ?? null,
      stage: row.stage ?? null,
    }),
    evidence_card: buildEvidenceCard(
      (row as AnyRow).evidence_items as ClientEvidenceRow[] | null,
      requirement_rows.map((r) => ({ label: r.label, importance: r.importance })),
    ),
    evaluation: {
      engine_version: run?.engine_version ?? null,
      blueprint_version: run?.blueprint_version ?? null,
      contradiction:
        run?.contradiction_status && run.contradiction_status !== "none"
          ? String(run.contradiction_status)
          : null,
      completed_at: run?.completed_at ?? null,
      method: normalizeEvaluationMethod((run as AnyRow)?.evaluation_method),
      method_label: clientMethodLabel((run as AnyRow)?.evaluation_method),
      category_breakdown: Array.isArray((run?.result as AnyRow)?.category_scores) ? (run.result as AnyRow).category_scores : [],
    },
  };
}



// ─── Role progress ("where we are") ─────────────────────────────────────────

export type RoleStageDates = {
  sourcing: string | null;
  screening: string | null;
  shortlist: string | null;
  offer: string | null;
};

/**
 * Earliest real timestamp per role for each client-facing progress stage.
 * Derived only from records the client's own org owns (RLS applies).
 */
export async function loadRoleStageDates(
  supabase: AnyRow,
  orgId: string,
  positionIds?: string[],
): Promise<Map<string, RoleStageDates>> {
  const out = new Map<string, RoleStageDates>();
  const take = (pid: string): RoleStageDates => {
    let v = out.get(pid);
    if (!v) {
      v = { sourcing: null, screening: null, shortlist: null, offer: null };
      out.set(pid, v);
    }
    return v;
  };
  const min = (a: string | null, b: string | null | undefined) =>
    b && (!a || b < a) ? b : a;

  const scoped = <T>(q: T): T =>
    positionIds && positionIds.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q as any).in("position_id", positionIds)
      : q;

  // Sourcing — first outreach campaign started for the role.
  const { data: campaigns } = await scoped(
    supabase
      .from("outreach_campaigns")
      .select("position_id, started_at, created_at, is_test_record")
      .eq("organization_id", orgId),
  );
  for (const c of ((campaigns as AnyRow[]) ?? [])) {
    if (c.is_test_record || !c.position_id) continue;
    const row = take(c.position_id);
    row.sourcing = min(row.sourcing, c.started_at ?? c.created_at);
  }

  // Screening — first candidate worked on for the role (visible to the client).
  const { data: matches } = await scoped(
    supabase
      .from("candidate_matches")
      .select("position_id, created_at, delivered_at, stage")
      .eq("organization_id", orgId)
      .eq("client_visibility", "visible"),
  );
  for (const m of ((matches as AnyRow[]) ?? [])) {
    if (!m.position_id) continue;
    const row = take(m.position_id);
    row.screening = min(row.screening, m.created_at ?? m.delivered_at);
    if (m.stage === "shortlisted" || m.stage === "interview_process") {
      row.shortlist = min(row.shortlist, m.delivered_at ?? m.created_at);
    }
    if (m.stage === "offer" || m.stage === "hired") {
      row.offer = min(row.offer, m.delivered_at ?? m.created_at);
    }
  }

  // Shortlist / Offer — first time a candidate actually reached that stage.
  const { data: history } = await scoped(
    supabase
      .from("candidate_stage_history")
      .select("position_id, to_stage, created_at")
      .eq("organization_id", orgId)
      .in("to_stage", ["shortlisted", "interview_process", "offer", "hired"]),
  );
  for (const h of ((history as AnyRow[]) ?? [])) {
    if (!h.position_id) continue;
    const row = take(h.position_id);
    if (h.to_stage === "offer" || h.to_stage === "hired") {
      row.offer = min(row.offer, h.created_at);
      row.shortlist = min(row.shortlist, h.created_at);
    } else {
      row.shortlist = min(row.shortlist, h.created_at);
    }
  }

  return out;
}


// ─── Verified evidence for shortlist cards ──────────────────────────────────

/**
 * Load verified, shareable evidence for a set of matches. Reads the
 * `candidate_evidence_client` view, which already excludes pending/rejected
 * rows and rows that failed integrity checks. RLS restricts it to matches the
 * caller may see.
 */
export async function loadClientEvidenceItems(
  supabase: AnyRow,
  matchIds: string[],
): Promise<Map<string, ClientEvidenceRow[]>> {
  const out = new Map<string, ClientEvidenceRow[]>();
  if (matchIds.length === 0) return out;
  const { data, error } = await supabase
    .from("candidate_evidence_client")
    .select(
      "id, candidate_match_id, rubric_criterion_key, rubric_dimension_key, result, match_type, factual_quote, interpretation, source_kind, source_ref, source_location",
    )
    .in("candidate_match_id", matchIds);
  if (error) throw new Error(error.message);
  for (const r of ((data as AnyRow[]) ?? [])) {
    const key = String(r.candidate_match_id);
    const list = out.get(key) ?? [];
    list.push(r as ClientEvidenceRow);
    out.set(key, list);
  }
  return out;
}
