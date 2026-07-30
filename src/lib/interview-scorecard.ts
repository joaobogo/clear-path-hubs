// Structured interview feedback — a scorecard against the role's own criteria.
//
// Ratings are captured per requirement so feedback is comparable across
// interviewers and candidates, instead of a paragraph of free text.

export type ScorecardRating = 1 | 2 | 3 | 4 | null;

export const RATING_LABEL: Record<Exclude<ScorecardRating, null>, string> = {
  1: "Not demonstrated",
  2: "Partially demonstrated",
  3: "Demonstrated",
  4: "Clearly exceeds",
};

export type ScorecardCriterion = {
  /** Stable key derived from the requirement label. */
  key: string;
  label: string;
  /** "must" (required at intake) or "nice" (preferred). */
  kind: "must" | "nice";
  rating: ScorecardRating;
  note: string;
};

export type Recommendation = "strong_yes" | "yes" | "no_decision" | "no" | "strong_no";

export const RECOMMENDATIONS: Recommendation[] = [
  "strong_yes",
  "yes",
  "no_decision",
  "no",
  "strong_no",
];

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  strong_yes: "Strong yes — move to offer",
  yes: "Yes — continue",
  no_decision: "Undecided — need another view",
  no: "No — not for this role",
  strong_no: "Strong no",
};

export type Scorecard = {
  criteria: ScorecardCriterion[];
  recommendation: Recommendation;
  strengths: string;
  concerns: string;
  summary: string;
};

export function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

type RawRequirement = { label?: unknown; text?: unknown; name?: unknown } | string;

function labelOf(r: RawRequirement): string | null {
  if (typeof r === "string") return r.trim() || null;
  if (!r || typeof r !== "object") return null;
  const v = r.label ?? r.text ?? r.name;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Build a blank scorecard from the role's requirements captured at intake. */
export function buildCriteria(
  requirements: unknown,
  preferred: unknown,
): ScorecardCriterion[] {
  const rows: ScorecardCriterion[] = [];
  const seen = new Set<string>();
  const push = (raw: unknown, kind: "must" | "nice") => {
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      const label = labelOf(r as RawRequirement);
      if (!label) continue;
      const key = slugKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({ key, label, kind, rating: null, note: "" });
    }
  };
  push(requirements, "must");
  push(preferred, "nice");
  return rows;
}

/** Merge a saved scorecard onto the role's current criteria list. */
export function mergeCriteria(
  base: ScorecardCriterion[],
  saved: unknown,
): ScorecardCriterion[] {
  const savedRows = Array.isArray(saved) ? (saved as ScorecardCriterion[]) : [];
  const byKey = new Map(savedRows.map((r) => [r.key, r]));
  const merged = base.map((c) => {
    const s = byKey.get(c.key);
    byKey.delete(c.key);
    return s ? { ...c, rating: normRating(s.rating), note: typeof s.note === "string" ? s.note : "" } : c;
  });
  // Keep criteria that were rated before the role changed, so nothing is lost.
  for (const leftover of byKey.values()) {
    if (leftover?.label) {
      merged.push({
        key: leftover.key,
        label: leftover.label,
        kind: leftover.kind === "nice" ? "nice" : "must",
        rating: normRating(leftover.rating),
        note: typeof leftover.note === "string" ? leftover.note : "",
      });
    }
  }
  return merged;
}

export function normRating(v: unknown): ScorecardRating {
  const n = typeof v === "number" ? v : Number(v);
  return n === 1 || n === 2 || n === 3 || n === 4 ? (n as ScorecardRating) : null;
}

export type ScorecardCompleteness = {
  rated: number;
  total: number;
  requiredRated: number;
  requiredTotal: number;
  complete: boolean;
  /** Ratio of met (3-4) among rated criteria — presentational only. */
  metRatio: number | null;
};

export function completeness(criteria: ScorecardCriterion[]): ScorecardCompleteness {
  const rated = criteria.filter((c) => c.rating != null);
  const required = criteria.filter((c) => c.kind === "must");
  const requiredRated = required.filter((c) => c.rating != null);
  const met = rated.filter((c) => (c.rating ?? 0) >= 3).length;
  return {
    rated: rated.length,
    total: criteria.length,
    requiredRated: requiredRated.length,
    requiredTotal: required.length,
    complete: required.length > 0 ? requiredRated.length === required.length : rated.length > 0,
    metRatio: rated.length > 0 ? met / rated.length : null,
  };
}

/** One-line plain-language summary for lists and the hire handoff. */
export function scorecardHeadline(
  recommendation: Recommendation,
  c: ScorecardCompleteness,
): string {
  const coverage =
    c.total > 0 ? `${c.rated} of ${c.total} criteria rated` : "no criteria on this role yet";
  return `${RECOMMENDATION_LABEL[recommendation]} · ${coverage}`;
}

export function emptyScorecard(criteria: ScorecardCriterion[]): Scorecard {
  return { criteria, recommendation: "no_decision", strengths: "", concerns: "", summary: "" };
}

// ─── Guarantee terms ────────────────────────────────────────────────────────

export type GuaranteeTerms = {
  days: number | null;
  startsOn: string | null;
  terms: string | null;
  visibleToClient: boolean;
};

export function guaranteeEndDate(g: GuaranteeTerms, startDate: string | null): string | null {
  const base = g.startsOn ?? startDate;
  if (!base || !g.days) return null;
  const d = new Date(`${base}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + g.days);
  return d.toISOString().slice(0, 10);
}

export function guaranteeLine(g: GuaranteeTerms, startDate: string | null): string | null {
  if (!g.visibleToClient) return null;
  if (!g.days) return null;
  const end = guaranteeEndDate(g, startDate);
  return end
    ? `${g.days}-day replacement guarantee, running to ${end}.`
    : `${g.days}-day replacement guarantee, starting on the agreed start date.`;
}
