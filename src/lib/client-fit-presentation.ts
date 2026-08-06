// Client-safe candidate presentation contract.
// Pure functions. No DB access. Consumed by client-kpi.server.ts and the page.
//
// Two concerns live here:
//   1) Fit-band normalisation — internal labels → Client-facing language + tone.
//   2) Interview-guide generator — deterministic, evidence-grounded, personalised.
//
// Thresholds are not defined in this file. Any score → band decision defers to
// src/lib/scoring/bands.ts.

import { classifyBand, type ScoreBandKey } from "@/lib/scoring/bands";


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


const BAND_TABLE: Record<FitBand, Omit<FitPresentation, "band">> = {
  exceptional: {
    headline: "Exceptional Match",
    recommendation: "Prioritise for interview",
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
    headline: "Not Recommended",
    recommendation: "Requirements not evidenced",
    tone: "dissuade",
    accent: "slate",
  },
};

/**
 * Normalise a raw fit label + numeric score into the Client-facing fit band.
 * Never surfaces internal labels ("not_a_fit", "manual_review_required", …).
 */
export function toFitPresentation(
  rawLabel: string | null | undefined,
  score: number | null | undefined,
): FitPresentation {
  let band: FitBand | null = null;
  if (rawLabel) {
    const key = rawLabel.toLowerCase().replace(/[^a-z_]/g, "");
    band = RAW_LABEL_MAP[key] ?? null;
  }
  if (!band && typeof score === "number") {
    // Numeric fallback derives from the ONE band table, never local cut-offs.
    band = CANONICAL_TO_FIT_BAND[classifyBand(score)] ?? null;
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
  | "not_applicable";

export type RequirementRow = {
  id: string;
  label: string;
  importance: "must_have" | "preferred";
  status: RequirementStatus;
  explanation: string | null;
  evidence: Array<{ source: string | null; snippet: string }>;
};

export type CoverageSummary = {
  must_total: number;
  must_met: number;
  must_partial: number;
  must_missing: number;
  preferred_total: number;
  preferred_met: number;
  overall_pct: number; // 0..100
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function normStatus(raw: unknown): RequirementStatus {
  const s = String(raw ?? "").toLowerCase();
  if (["met", "matched", "covered", "yes", "true"].includes(s)) return "met";
  if (["partial", "partially", "partially_met", "weak"].includes(s)) return "partial";
  if (["contradicted", "conflict", "conflicts"].includes(s)) return "contradicted";
  if (["not_applicable", "na", "n/a"].includes(s)) return "not_applicable";
  return "not_evidenced";
}

/**
 * Merge the position's declared requirements with the score-run coverage map.
 * Guarantees a row for every declared requirement so the Client sees the full
 * matrix (met + partial + missing) even when the LLM omits negatives.
 */
export function buildRequirementRows(
  position: { requirements?: unknown; preferred_requirements?: unknown } | null,
  coverage: unknown,
): RequirementRow[] {
  const rows: RequirementRow[] = [];
  const cov = (coverage ?? {}) as AnyRow;

  // Index whatever the run gave us by label (case-insensitive).
  const covIndex = new Map<string, AnyRow>();
  const stash = (arr: unknown, defaultStatus: RequirementStatus) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const label =
        typeof item === "string"
          ? item
          : item?.label ?? item?.requirement ?? item?.name ?? null;
      if (!label) continue;
      const key = String(label).toLowerCase().trim();
      const status = normStatus(
        typeof item === "string" ? defaultStatus : item?.status ?? defaultStatus,
      );
      covIndex.set(key, {
        label: String(label),
        status,
        explanation:
          typeof item === "string"
            ? null
            : item?.explanation ?? item?.rationale ?? item?.note ?? null,
        evidence:
          typeof item === "string"
            ? []
            : Array.isArray(item?.evidence)
              ? item.evidence
                  .slice(0, 3)
                  .map((e: AnyRow) => ({
                    source: e?.source ?? e?.section ?? null,
                    snippet: String(e?.snippet ?? e?.text ?? e?.value ?? ""),
                  }))
                  .filter((e: AnyRow) => e.snippet)
              : [],
      });
    }
  };
  stash(cov.requirements, "met");
  stash(cov.rows, "met");
  stash(cov.matched, "met");
  stash(cov.partial, "partial");
  stash(cov.missing, "not_evidenced");
  stash(cov.contradicted, "contradicted");

  const push = (
    declared: unknown,
    importance: "must_have" | "preferred",
  ) => {
    if (!Array.isArray(declared)) return;
    declared.forEach((raw: AnyRow, i: number) => {
      const label =
        typeof raw === "string" ? raw : raw?.label ?? raw?.text ?? raw?.name ?? null;
      if (!label) return;
      const key = String(label).toLowerCase().trim();
      const found = covIndex.get(key);
      rows.push({
        id: `${importance}-${i}`,
        label: String(label),
        importance,
        status: found?.status ?? "not_evidenced",
        explanation: found?.explanation ?? null,
        evidence: found?.evidence ?? [],
      });
      covIndex.delete(key);
    });
  };
  push(position?.requirements, "must_have");
  push(position?.preferred_requirements, "preferred");

  // If the position declared nothing, fall back to whatever the run named,
  // so the Client still sees a coverage matrix.
  if (rows.length === 0) {
    for (const [, v] of covIndex) {
      rows.push({
        id: `run-${rows.length}`,
        label: v.label,
        importance: "must_have",
        status: v.status,
        explanation: v.explanation,
        evidence: v.evidence,
      });
    }
  }
  return rows;
}

export function summariseCoverage(rows: RequirementRow[]): CoverageSummary {
  const must = rows.filter((r) => r.importance === "must_have");
  const pref = rows.filter((r) => r.importance === "preferred");
  const met = (r: RequirementRow) => r.status === "met";
  const partial = (r: RequirementRow) => r.status === "partial";
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
        (r.status === "met" ? 1 : r.status === "partial" ? 0.5 : 0) *
          (r.importance === "must_have" ? 1 : 0.5),
      0,
    ) /
    rows.reduce(
      (acc, r) => acc + (r.importance === "must_have" ? 1 : 0.5),
      0,
    );
  return {
    must_total: must.length,
    must_met,
    must_partial,
    must_missing,
    preferred_total: pref.length,
    preferred_met,
    overall_pct: Math.round((Number.isFinite(weighted) ? weighted : 0) * 100),
    // total keeps lint quiet on unused var
    ...({ _total: total } as Record<string, number>),
  };
}

// ── Interview guide ──────────────────────────────────────────────────────────

export type InterviewQuestion = {
  id: string;
  group:
    | "Experience Validation"
    | "Requirement Gaps"
    | "Technical Depth"
    | "Impact & Achievements"
    | "Motivation & Availability";
  question: string;
  why: string;
  target: string; // requirement or concern being tested
  indicators: string[];
  followUp?: string;
};

/**
 * Deterministic personalised interview guide. Never generic — every question
 * cites either a specific requirement, strength, or concern from THIS
 * candidate's evidence graph. When we cannot ground a question, we skip it.
 */
export function buildInterviewGuide(input: {
  positionTitle: string | null;
  rows: RequirementRow[];
  strengths: string[];
  concerns: string[];
  availability: string | null;
  workAuth: string | null;
}): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  const positionRef = input.positionTitle ? ` for the ${input.positionTitle} role` : "";

  // 1) Requirement gaps first — the ones the Client most needs to close.
  const gaps = input.rows.filter(
    (r) => r.status === "partial" || r.status === "not_evidenced" || r.status === "contradicted",
  );
  for (const r of gaps.slice(0, 3)) {
    out.push({
      id: `gap-${r.id}`,
      group: "Requirement Gaps",
      question: `Can you walk us through your most recent hands-on experience with ${r.label.toLowerCase()}?`,
      why:
        r.status === "partial"
          ? `The CV shows related work, but does not clearly evidence "${r.label}"${positionRef}.`
          : r.status === "contradicted"
            ? `The available evidence conflicts on "${r.label}"${positionRef}.`
            : `"${r.label}" is a stated requirement${positionRef} but no supporting evidence was found in the CV or screening answers.`,
      target: r.label,
      indicators: [
        "Cites a concrete, recent example (last 24 months)",
        "Explains personal responsibility, not team scope",
        "Names specific tools, methods, or outcomes",
      ],
      followUp: "Ask for the timeframe and measurable impact.",
    });
  }

  // 2) Strengths — validate the highlights are real.
  for (const s of input.strengths.slice(0, 2)) {
    out.push({
      id: `str-${out.length}`,
      group: "Impact & Achievements",
      question: `Tell us about the initiative you're most proud of that involved ${s.toLowerCase()}. What did you personally deliver and how was impact measured?`,
      why: `"${s}" is one of the strongest supported areas in the profile.`,
      target: s,
      indicators: [
        "Names a specific project and timeframe",
        "Separates personal contribution from team result",
        "Quantifies outcome (users, revenue, cycle-time, quality)",
      ],
    });
  }

  // 3) Availability / logistics only when the data invites the question.
  if (input.availability && /notice|weeks?|months?/i.test(input.availability)) {
    out.push({
      id: "avail",
      group: "Motivation & Availability",
      question: `You've indicated ${input.availability.toLowerCase()}. What's driving your timing and are there commitments we should plan around?`,
      why: "Confirm the stated availability window and surface hidden constraints.",
      target: "Availability",
      indicators: [
        "Explains why they're open now",
        "Confirms the notice window is firm",
        "Flags PTO, relocation, or overlap constraints",
      ],
    });
  }
  if (input.workAuth) {
    out.push({
      id: "auth",
      group: "Motivation & Availability",
      question: `Please confirm your current work authorization and whether it covers the location and hours for this role.`,
      why: "Confirm the authorization the profile lists still applies to this role.",
      target: "Work authorization",
      indicators: ["Confirms current status", "Confirms expiry / renewal", "Confirms location match"],
    });
  }

  // 4) One concern (dedupe with gaps by target).
  for (const c of input.concerns.slice(0, 1)) {
    const already = out.some((q) => q.target.toLowerCase() === c.toLowerCase());
    if (already) continue;
    out.push({
      id: `con-${out.length}`,
      group: "Experience Validation",
      question: `We noted "${c}" as an area to validate. Can you walk us through how you've handled this in a recent role?`,
      why: `Named concern in the evidence review${positionRef}.`,
      target: c,
      indicators: ["Directly addresses the concern", "Provides a concrete example", "Reflects on what they learned"],
    });
  }

  return out.slice(0, 8);
}

// Prettify a screaming-uppercase pipe-separated headline into readable text.
export function prettifyHeadline(raw: string | null): {
  headline: string | null;
  chips: string[];
} {
  if (!raw) return { headline: null, chips: [] };
  const parts = raw
    .split(/\s*[|·•]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { headline: null, chips: [] };
  const titleCase = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
      .join(" ")
      .replace(/\b(and|or|of|the|for|in|on)\b/gi, (m) => m.toLowerCase());
  const [primary, ...rest] = parts;
  return {
    headline: titleCase(primary),
    chips: rest.slice(0, 4).map(titleCase),
  };
}
