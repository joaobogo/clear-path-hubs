// Client-safe candidate presentation contract.
// Pure functions. No DB access. Consumed by client-kpi.server.ts and the page.
//
// Two concerns live here:
//   1) Fit-band normalisation — internal labels → Client-facing language + tone.
//   2) Interview-guide generator — deterministic, evidence-grounded, personalised.
//
// Thresholds are not defined in this file. Any score → band decision defers to
// src/lib/scoring/bands.ts.

import {
  cleanQuote,
  isTemplatedEvidence,
  isGenericSkillsList,
  isRelevantEvidence,
  isCandidateHeadline,
} from "@/lib/evidence/quote-hygiene";
import { classifyBand, type ScoreBandKey, isTopBand } from "@/lib/scoring/bands";


/**
 * ONE fit vocabulary for the whole client workspace: chips, detail pages,
 * board, compare and filters. The keys are the canonical band keys from
 * `src/lib/scoring/bands.ts` so a band can never be renamed on the way to the
 * screen ("Strong Match", "Good Potential" and "Mixed Fit" are gone).
 */
export type FitBand =
  | "exceptional"
  | "top"
  | "strong"
  | "consider"
  | "not_recommended";

export type FitPresentation = {
  band: FitBand;
  headline: string; // e.g. "Strong"
  recommendation: string; // short verb clause
  tone: "confident" | "positive" | "neutral" | "cautious" | "dissuade";
  accent: "emerald" | "sky" | "amber" | "slate" | "rose";
};

/**
 * The ONE place raw band vocabulary is normalised. Covers all three historic
 * systems: the engine's fit_label, the DB `score_band` enum, and legacy
 * presentation words. Anything unmapped falls back to score thresholds, then
 * to "consider" — never to an internal label.
 */
const RAW_LABEL_MAP: Record<string, FitBand> = {
  // engine (scoring-engine.server.ts)
  strong_fit: "strong",
  worth_considering: "consider",
  not_a_fit: "not_recommended",
  unknown: "consider",
  // DB score_band enum
  exceptional: "exceptional",
  top: "top",
  strong: "strong",
  consider: "consider",
  not_recommended: "not_recommended",
  unscored: "consider",
  // legacy presentation words
  excellent: "exceptional",
  high: "top",
  good: "strong",
  potential: "strong",
  medium: "consider",
  mixed: "consider",
  average: "consider",
  low: "not_recommended",
  limited: "not_recommended",
  weak: "not_recommended",
  none: "not_recommended",
  running: "consider",
};


/**
 * Canonical band key → client-facing fit band. Identity for every scored band:
 * 95+ Exceptional, 85–94 Top, 70–84 Strong, 50–69 Consider, below 50 Not
 * recommended. No re-banding happens between the score and the label.
 */
const CANONICAL_TO_FIT_BAND: Record<ScoreBandKey, FitBand> = {
  exceptional: "exceptional",
  top: "top",
  strong: "strong",
  consider: "consider",
  not_recommended: "not_recommended",
  unscored: "consider",
};




const BAND_TABLE: Record<FitBand, Omit<FitPresentation, "band">> = {
  exceptional: {
    headline: "Exceptional",
    recommendation: "Prioritise for interview",
    tone: "confident",
    accent: "emerald",
  },
  top: {
    headline: "Top",
    recommendation: "Recommend interview",
    tone: "confident",
    accent: "emerald",
  },
  strong: {
    headline: "Strong",
    recommendation: "Worth a conversation",
    tone: "positive",
    accent: "sky",
  },
  consider: {
    headline: "Consider",
    recommendation: "Review before deciding",
    tone: "neutral",
    accent: "amber",
  },
  not_recommended: {
    headline: "Not recommended",
    recommendation: "Requirements not evidenced",
    tone: "dissuade",
    accent: "slate",
  },
};


/**
 * Normalise a raw fit label + numeric score into the Client-facing fit band.
 * Never surfaces internal labels ("not_a_fit", "manual_review_required", …).
 *
 * The SCORE decides the band. Stored `fit_label` / `fit_band` strings are only
 * a fallback for runs that never recorded a number: historical runs were
 * written with older cut-offs (a 73 stored as `worth_considering`, a 50 stored
 * as `not_a_fit`), so trusting the string first made the headline contradict
 * the number shown next to it on the same card.
 */
export function toFitPresentation(
  rawLabel: string | null | undefined,
  score: number | null | undefined,
): FitPresentation {
  let band: FitBand | null = null;
  if (typeof score === "number" && Number.isFinite(score)) {
    // Derives from the ONE band table, never local cut-offs or stored strings.
    band = CANONICAL_TO_FIT_BAND[classifyBand(score)] ?? null;
  }
  if (!band && rawLabel) {
    const key = rawLabel.toLowerCase().replace(/[^a-z_]/g, "");
    band = RAW_LABEL_MAP[key] ?? null;
  }
  const resolved: FitBand = band ?? "consider";
  return { band: resolved, ...BAND_TABLE[resolved] };
}


// ── Requirement rows ─────────────────────────────────────────────────────────

export type RequirementStatus =
  | "met"
  | "partial"
  | "not_evidenced"
  | "contradicted"
  | "missing"
  | "not_applicable";

export type RequirementRow = {
  id: string;
  label: string;
  importance: "must_have" | "preferred";
  status: RequirementStatus;
  evidence: Array<{ label: string; snippet: string; source: string | null }>;
  explanation: string | null;
  interpretation: string | null;
  contradictions: Array<{ label: string; snippet: string; source: string | null }>;
  context: Array<{ label: string; snippet: string; source: string | null }>;
};

/** "5+ years building web apps" -> "5-years-building-web-apps" */
function slugifyRequirement(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type NormalisedRequirement = { id: string; label: string; explanation: string | null };

/**
 * Requirements reach this file in two shapes: the modern object form and the
 * older plain-string form still stored on many positions. Both must produce a
 * row with a stable id and a readable label.
 */
function normaliseRequirement(raw: any, importance: "must" | "pref", index: number): NormalisedRequirement {
  const label =
    typeof raw === "string"
      ? raw
      : (raw?.label ?? raw?.text ?? raw?.requirement ?? raw?.name ?? "").toString();
  const slug = slugifyRequirement(label) || `requirement-${index + 1}`;
  return {
    id: typeof raw === "string" || !raw?.id ? `${importance}-${slug}` : String(raw.id),
    label: label || `Requirement ${index + 1}`,
    explanation: typeof raw === "string" ? null : (raw?.explanation ?? null),
  };
}

/**
 * Evidence card presentation for the Journey tab.
 * A single source of truth for all client evidence displays.
 */
export function buildRequirementRows(
  pos: { requirements: any[]; preferred_requirements?: any[] } | null,
  coverage: any,
  evidenceItems: any[] | null,
): RequirementRow[] {
  const reqs = pos?.requirements ?? [];
  const prefs = pos?.preferred_requirements ?? [];

  const must = reqs.map((raw, i) => {
    const r = normaliseRequirement(raw, "must", i);
    return { ...r, importance: "must_have" as const, ...evidenceSupport(r, coverage, evidenceItems) };
  });
  const pref = prefs.map((raw, i) => {
    const r = normaliseRequirement(raw, "pref", i);
    return { ...r, importance: "preferred" as const, ...evidenceSupport(r, coverage, evidenceItems) };
  });
  return [...must, ...pref];
}

/** Does this evidence item belong to this requirement? Ids or labels may match. */
function evidenceMatchesRequirement(e: any, r: { id: string; label: string }): boolean {
  const label = r.label.trim().toLowerCase();
  const keys = [e?.requirement_id, e?.rubric_criterion_key, e?.criterion_key, e?.requirement, e?.label];
  return keys.some((k) => {
    if (typeof k !== "string") return false;
    const v = k.trim().toLowerCase();
    return v === r.id.toLowerCase() || v === label;
  });
}

function evidenceSnippet(e: any): string {
  return String(e?.snippet ?? e?.factual_quote ?? e?.quote ?? e?.text ?? "");
}

export function evidenceSupport(
  r: { id: string; label: string; explanation?: string | null },
  coverage: any,
  evidenceItems: any[] | null,
) {
  const matched = Array.isArray(coverage?.matched) ? coverage.matched : [];
  const partial = Array.isArray(coverage?.partial) ? coverage.partial : [];
  const contradicts = Array.isArray(coverage?.contradicts) ? coverage.contradicts : [];
  const listed = Array.isArray(coverage?.requirements) ? coverage.requirements : [];
  // The run's per-requirement verdicts. This is the same record the Compare
  // drawer's requirement grid reads, so both surfaces agree by construction.
  const assessed = Array.isArray(coverage?.requirement_assessment)
    ? coverage.requirement_assessment
    : [];

  // Coverage lists carry either requirement objects or bare requirement text,
  // depending on the engine version that produced the run. Both must match.
  const sameRequirement = (m: any) => {
    const label = r.label.trim().toLowerCase();
    if (typeof m === "string") return m.trim().toLowerCase() === label;
    if (m?.id != null && String(m.id) === r.id) return true;
    return String(m?.label ?? m?.text ?? "").trim().toLowerCase() === label;
  };

  const declared = listed.find(sameRequirement) ?? assessed.find(sameRequirement);
  let isMet = matched.some(sameRequirement) || declared?.status === "met";
  let isPartial = partial.some(sameRequirement) || declared?.status === "partial";
  const isContradicted = contradicts.some(sameRequirement) || declared?.status === "contradicted";


  const rawEvidence = Array.isArray(evidenceItems) ? evidenceItems : [];
  const mine = rawEvidence.filter((e: any) => evidenceMatchesRequirement(e, r));

  const evidence = mine
    .filter((e: any) => !e.contradiction && !isCandidateHeadline(evidenceSnippet(e)))
    .map((e: any) => ({
      label: e.label || "Evidence",
      snippet: cleanQuote(evidenceSnippet(e)),
      source: e.source || e.source_kind || null,
    }))
    .filter((e) => e.snippet.length > 0);

  const contradictions = mine
    .filter((e: any) => e.contradiction)
    .map((e: any) => ({
      label: e.label || "Contradiction",
      snippet: cleanQuote(evidenceSnippet(e)),
      source: e.source || e.source_kind || null,
    }));

  // With no coverage record, the candidate's own evidence decides the status.
  if (!declared && !isMet && !isPartial && !isContradicted && mine.length > 0) {
    const results = mine.map((e: any) => String(e.result ?? "").toLowerCase());
    if (results.some((v) => v === "strong" || v === "met" || v === "full")) isMet = true;
    else if (results.some((v) => v === "partial" || v === "weak")) isPartial = true;
  }

  let status: RequirementStatus = "not_evidenced";
  if (isContradicted) status = "contradicted";
  else if (isMet) status = "met";
  else if (isPartial) status = "partial";

  return {
    status,
    evidence,
    explanation: (r.explanation as string) || null,
    interpretation: null,
    contradictions,
    context: [],
  };
}

export type CoverageSummary = {
  met: number;
  partial: number;
  missing: number;
  must_met: number;
  must_partial: number;
  must_total: number;
  fit_score: number;
  fit_band: FitBand;
  tone: FitPresentation["tone"];
  accent: FitPresentation["accent"];
};

export function summariseCoverage(
  rows: RequirementRow[],
  fit: FitPresentation,
  score: number | null,
): CoverageSummary {
  const must = rows.filter((r) => r.importance === "must_have");
  const pref = rows.filter((r) => r.importance === "preferred");

  // Counts must agree with the requirement grid the client actually reads:
  // the grid renders r.status, so the summary counts r.status too. Evidence
  // availability is reported separately (evidence_support), never by silently
  // downgrading a met requirement to partial here.
  const met = (r: RequirementRow) => r.status === "met";
  const partial = (r: RequirementRow) => r.status === "partial";
  const missing = (r: RequirementRow) =>
    r.status === "not_evidenced" || r.status === "contradicted";


  const must_met = must.filter(met).length;
  const must_partial = must.filter(partial).length;
  const must_missing = must.filter(missing).length;
  const preferred_met = pref.filter(met).length;

  const totalCounted = rows.filter(r => r.status !== 'not_applicable').length || 1;
  const totalEvidenced = rows.filter(met).length;
  const coveragePct = totalEvidenced / totalCounted;

  return {
    met: must_met + preferred_met,
    partial: must_partial + pref.filter(partial).length,
    missing: must_missing + pref.filter(missing).length,
    must_met,
    must_partial,
    must_total: must.length,
    fit_score: score ?? Math.round(coveragePct * 100),
    fit_band: fit.band,
    tone: fit.tone,
    accent: fit.accent,
  };
}

export type InterviewQuestion = {
  id: string;
  requirement_label: string;
  importance: "must_have" | "preferred";
  question: string;
  why: string;
  indicators: string[];
  followUp: string | null;
  group: string;
  evidence_found?: string | null;
  status?: RequirementStatus;
  rationale?: string;
};

export type InterviewGuideItem = InterviewQuestion;

export function buildInterviewGuide(args: {
  positionTitle: string | null;
  rows: RequirementRow[];
  strengths: string[];
  concerns: string[];
  availability: string | null;
  workAuth: string | null;
}): InterviewGuideItem[] {
  const { rows, concerns } = args;
  
  // HONESTY GATE: Only ask about things that aren't fully evidenced.
  return rows
    .filter((r) => r.status !== "met" || r.evidence.length === 0)
    .map((r) => ({
      id: r.id,
      requirement_label: r.label,
      importance: r.importance,
      question: `Can you elaborate on your experience with ${r.label}?`,
      why: concerns.find(c => c.toLowerCase().includes(r.label.toLowerCase())) || 
           (r.status === "contradicted" ? "Address identified contradictions." : "Verify missing or partial evidence."),
      indicators: ["Specific project examples", "Quantifiable results", "Duration of experience"],
      followUp: null,
      group: r.importance === "must_have" ? "Core Requirements" : "Preferred Skills",
      status: r.status,
    }));
}

export function prettifyHeadline(headline: string | null): string {
  if (!headline) return "Candidate";
  return headline.replace(/Match$/i, "Fit").trim();
}
