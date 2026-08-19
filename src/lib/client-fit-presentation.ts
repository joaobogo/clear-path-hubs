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


export type FitBand =
  | "exceptional"
  | "strong"
  | "good"
  | "mixed"
  | "limited"
  | "not_recommended";

export type FitPresentation = {
  band: FitBand;
  headline: string; // e.g. "Strong Match"
  recommendation: string; // short verb clause
  tone: "confident" | "positive" | "neutral" | "cautious" | "dissuade";
  accent: "emerald" | "sky" | "amber" | "slate" | "rose";
};

/**
 * The ONE place raw band vocabulary is normalised. Covers all three historic
 * systems: the engine's fit_label, the DB `score_band` enum, and legacy
 * presentation words. Anything unmapped falls back to score thresholds, then
 * to "mixed" — never to an internal label.
 */
const RAW_LABEL_MAP: Record<string, FitBand> = {
  // engine (scoring-engine.server.ts)
  strong_fit: "strong",
  worth_considering: "mixed",
  not_a_fit: "not_recommended",
  unknown: "mixed",
  // DB score_band enum
  exceptional: "exceptional",
  top: "exceptional",
  strong: "strong",
  consider: "mixed",
  not_recommended: "not_recommended",
  unscored: "mixed",
  // legacy presentation words
  excellent: "exceptional",
  high: "strong",
  good: "good",
  potential: "good",
  medium: "mixed",
  mixed: "mixed",
  average: "mixed",
  low: "limited",
  limited: "limited",
  weak: "limited",
  none: "not_recommended",
};


/**
 * Canonical band key → client-facing fit band. Keeps the existing client
 * vocabulary while the numbers behind it live in one place.
 * 
 * HONESTY GATE (C9): 'top' scores (85-94) map to 'strong', 
 * and 'strong' scores (70-84) map to 'good'.
 */
const CANONICAL_TO_FIT_BAND: Record<ScoreBandKey, FitBand> = {
  exceptional: "exceptional",
  top: "strong",
  strong: "good",
  consider: "mixed",
  not_recommended: "not_recommended",
  unscored: "mixed",
};




const BAND_TABLE: Record<FitBand, Omit<FitPresentation, "band">> = {
  exceptional: {
    headline: "Exceptional Match",
    recommendation: "Prioritize for interview",
    tone: "confident",
    accent: "emerald",
  },
  strong: {
    headline: "Strong Match",
    recommendation: "Recommend interview",
    tone: "confident",
    accent: "emerald",
  },
  good: {
    headline: "Good Potential",
    recommendation: "Worth a conversation",
    tone: "positive",
    accent: "sky",
  },
  mixed: {
    headline: "Mixed Fit",
    recommendation: "Review before deciding",
    tone: "neutral",
    accent: "amber",
  },
  limited: {
    headline: "Limited Fit",
    recommendation: "Interview only if a gap can be closed",
    tone: "cautious",
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
  band ??= "mixed";
  return { band, ...BAND_TABLE[band] };
}


// ── Requirement rows ─────────────────────────────────────────────────────────

export type RequirementStatus =
  | "met"
  | "partial"
  | "not_evidenced"
  | "contradicted"
  | "missing";

export type RequirementRow = {
  id: string;
  label: string;
  importance: "must_have" | "preferred";
  status: RequirementStatus;
  evidence: Array<{ label: string; snippet: string }>;
  interpretation: string | null;
  contradictions: Array<{ label: string; snippet: string }>;
};

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

  const must = reqs.map((r) => {
    const support = evidenceSupport(r, coverage, evidenceItems);
    return {
      id: r.id,
      label: r.label,
      importance: "must_have" as const,
      ...support,
    };
  });
  const pref = prefs.map((r) => {
    const support = evidenceSupport(r, coverage, evidenceItems);
    return {
      id: r.id,
      label: r.label,
      importance: "preferred" as const,
      ...support,
    };
  });
  return [...must, ...pref];
}

export function evidenceSupport(r: any, coverage: any, evidenceItems: any[] | null) {
  const matched = Array.isArray(coverage?.matched) ? coverage.matched : [];
  const partial = Array.isArray(coverage?.partial) ? coverage.partial : [];
  const contradicts = Array.isArray(coverage?.contradicts) ? coverage.contradicts : [];
  
  const isMet = matched.some((m: any) => m.id === r.id);
  const isPartial = partial.some((m: any) => m.id === r.id);
  const isContradicted = contradicts.some((m: any) => m.id === r.id);

  const rawEvidence = Array.isArray(evidenceItems) ? evidenceItems : [];
  const evidence = rawEvidence
    .filter((e: any) => e.requirement_id === r.id && !e.contradiction && !isCandidateHeadline(e.snippet))
    .map((e: any) => ({
      label: e.label || "Evidence",
      snippet: cleanQuote(e.snippet),
      source: e.source || null,
    }));

  const contradictions = rawEvidence
    .filter((e: any) => e.requirement_id === r.id && e.contradiction)
    .map((e: any) => ({
      label: e.label || "Contradiction",
      snippet: cleanQuote(e.snippet),
      source: e.source || null,
    }));

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

  // HONESTY GATE (C2/C3/C9): A requirement is only met if it has real verified evidence.
  // Counts only status === "met" AND evidence.length > 0 to ensure numbers don't lie.
  const met = (r: RequirementRow) => r.status === "met" && r.evidence.length > 0;
  const partial = (r: RequirementRow) => r.status === "partial" || (r.status === "met" && r.evidence.length === 0);
  const missing = (r: RequirementRow) =>
    r.status === "not_evidenced" || r.status === "contradicted";

  const must_met = must.filter(met).length;
  const must_partial = must.filter(partial).length;
  const must_missing = must.filter(missing).length;
  const preferred_met = pref.filter(met).length;

  const total = rows.length || 1;
  const weighted =
    rows.reduce(
      (acc, r) =>
        acc +
        (met(r) ? 1 : partial(r) ? 0.5 : 0) *
          (r.importance === "must_have" ? 1 : 0.5),
      0,
    ) /
    (rows.reduce(
      (acc, r) => acc + (r.importance === "must_have" ? 1 : 0.5),
      0,
    ) || 1);

  return {
    met: must_met + preferred_met,
    partial: must_partial + pref.filter(partial).length,
    missing: must_missing + pref.filter(missing).length,
    must_met,
    must_total: must.length,
    fit_score: score ?? Math.round(weighted * 100),
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

export type InterviewGuideItem = {
  id: string;
  requirement_label: string;
  importance: "must_have" | "preferred";
  question: string;
  why: string;
  indicators: string[];
  followUp: string | null;
  group: string;
};

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
    }));
}

export function prettifyHeadline(headline: string | null): string {
  if (!headline) return "Candidate";
  return headline.replace(/Match$/i, "Fit").trim();
}
