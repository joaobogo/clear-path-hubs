/**
 * Eligibility, Recommendation, and Confidence — the canonical vocabulary that
 * keeps the five separate concepts (Eligibility / Fit / Confidence /
 * Recommendation / Stage) from bleeding into each other.
 *
 * These enums mirror the DB enums:
 *   public.eligibility_status
 *   public.recommendation_status
 *
 * Pipeline stage is a separate axis and lives with the match_stage vocabulary
 * (candidate_matches.stage). It is deliberately NOT combined here.
 */

// ─── Eligibility ────────────────────────────────────────────────────────────

export const ELIGIBILITY_STATUSES = [
  "not_evaluated",
  "eligible",
  "not_eligible",
  "needs_validation",
  "excepted",
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const ELIGIBILITY_LABELS: Record<EligibilityStatus, string> = {
  not_evaluated: "Not evaluated",
  eligible: "Eligible",
  not_eligible: "Not eligible",
  needs_validation: "Needs validation",
  excepted: "Exception granted",
};

export const ELIGIBILITY_TONE: Record<
  EligibilityStatus,
  "positive" | "neutral" | "cautious" | "blocked" | "muted"
> = {
  not_evaluated: "muted",
  eligible: "positive",
  not_eligible: "blocked",
  needs_validation: "cautious",
  excepted: "neutral",
};

// ─── Recommendation ─────────────────────────────────────────────────────────

export const RECOMMENDATION_STATUSES = [
  "pending",
  "shortlist",
  "review",
  "hold_for_validation",
  "do_not_recommend",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const RECOMMENDATION_LABELS: Record<RecommendationStatus, string> = {
  pending: "Pending",
  shortlist: "Shortlist",
  review: "Review",
  hold_for_validation: "Hold for validation",
  do_not_recommend: "Do not recommend",
};

// ─── Per-check status (rows in eligibility_checks) ──────────────────────────

export const QUALIFIER_CHECK_STATUSES = [
  "passed",
  "failed",
  "unknown",
  "excepted",
] as const;
export type QualifierCheckStatus = (typeof QUALIFIER_CHECK_STATUSES)[number];

export const QUALIFIER_KINDS = ["qualifier", "disqualifier"] as const;
export type QualifierKind = (typeof QUALIFIER_KINDS)[number];

// ─── Evidence confidence banding ────────────────────────────────────────────
/**
 * Confidence is orthogonal to fit. A high score with 40% confidence must
 * never look identical to the same score with 90% confidence.
 */
export type ConfidenceBand = "high" | "medium" | "low" | "insufficient";

export function classifyConfidence(
  pct: number | null | undefined,
): ConfidenceBand {
  if (pct === null || pct === undefined || !Number.isFinite(pct))
    return "insufficient";
  const c = Math.max(0, Math.min(100, pct));
  if (c >= 80) return "high";
  if (c >= 60) return "medium";
  if (c >= 40) return "low";
  return "insufficient";
}

export const CONFIDENCE_LABELS: Record<ConfidenceBand, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient evidence",
};

// ─── Canonical qualifier catalogue ──────────────────────────────────────────
/**
 * Well-known hard-qualifier keys. Positions can extend with custom ones,
 * but these render with first-class UI copy and analytics rollups.
 */
export const KNOWN_QUALIFIERS = {
  work_authorization: "Work authorization",
  mandatory_license: "Mandatory licence / credential",
  location: "Location / on-site availability",
  required_language: "Required language",
  employment_type: "Employment type",
  availability: "Start availability",
  compensation_range: "Compensation range",
  legal_credential: "Legally required credential",
} as const;
export type KnownQualifierKey = keyof typeof KNOWN_QUALIFIERS;
