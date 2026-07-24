/**
 * Client-safe rubric vocabulary. Mirrors the seed rows in the
 * `rubric_templates` table and the CHECK constraints on
 * `candidate_evidence_items` / `scoring_debug_events`.
 *
 * The database is the source of truth. This module gives TypeScript callers
 * the same vocabulary so schemas, UI, and engine agree without drift.
 */

// ────────────────────────────────────────────────────────────────────────────
// Canonical TaaSFlow methodology (the public website's default weighting).
// ────────────────────────────────────────────────────────────────────────────

export const METHODOLOGY_DIMENSIONS = [
  {
    key: "role_fit",
    name: "Role Fit",
    default_weight_pct: 35,
    description:
      "Match between candidate experience and the specific responsibilities of this role.",
  },
  {
    key: "evidence",
    name: "Evidence",
    default_weight_pct: 30,
    description:
      "Documented, verifiable proof of the responsibilities the role requires.",
  },
  {
    key: "logistics",
    name: "Logistics",
    default_weight_pct: 20,
    description:
      "Location, availability, compensation, work permission, and other hard filters.",
  },
  {
    key: "signal",
    name: "Signal",
    default_weight_pct: 15,
    description:
      "Soft indicators: engagement quality, communication, motivation, references.",
  },
] as const;

export type MethodologyDimensionKey =
  (typeof METHODOLOGY_DIMENSIONS)[number]["key"];

export const METHODOLOGY_TOTAL_WEIGHT = 100;

export const ANCHOR_SCALE = {
  weak: { score_min: 0, score_max: 33, label: "Weak / missing evidence" },
  partial: {
    score_min: 34,
    score_max: 66,
    label: "Partial / transferable evidence",
  },
  strong: { score_min: 67, score_max: 100, label: "Strong / direct evidence" },
} as const;

export type AnchorStrength = keyof typeof ANCHOR_SCALE;

// ────────────────────────────────────────────────────────────────────────────
// Criterion classifications
// ────────────────────────────────────────────────────────────────────────────

export const CRITERION_CLASSIFICATIONS = [
  "must_have",
  "nice_to_have",
  "qualifier",
  "disqualifier",
] as const;
export type CriterionClassification =
  (typeof CRITERION_CLASSIFICATIONS)[number];

// A qualifier is a hard gate (yes/no). A disqualifier is a hard fail.
// A must-have contributes weighted score but blocks approval if empty.
// A nice-to-have contributes weighted score but does not block approval.
export const CLASSIFICATION_BEHAVIOR: Record<
  CriterionClassification,
  { weighted: boolean; blocks_approval: boolean; blocks_publish: boolean }
> = {
  must_have: { weighted: true, blocks_approval: true, blocks_publish: false },
  nice_to_have: {
    weighted: true,
    blocks_approval: false,
    blocks_publish: false,
  },
  qualifier: { weighted: false, blocks_approval: true, blocks_publish: true },
  disqualifier: {
    weighted: false,
    blocks_approval: true,
    blocks_publish: true,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Evidence match types (Prompt 3)
// ────────────────────────────────────────────────────────────────────────────

export const EVIDENCE_MATCH_TYPES = [
  "direct",
  "semantic_equivalent",
  "transferable",
  "scale",
  "recency",
  "duration",
  "seniority",
  "outcome",
  "domain_relevance",
  "conflicting",
  "missing",
] as const;
export type EvidenceMatchType = (typeof EVIDENCE_MATCH_TYPES)[number];

export const EVIDENCE_MATCH_TYPE_LABELS: Record<EvidenceMatchType, string> = {
  direct: "Direct match",
  semantic_equivalent: "Semantic equivalent",
  transferable: "Transferable / adjacent",
  scale: "Scale / complexity",
  recency: "Recency",
  duration: "Duration",
  seniority: "Seniority / ownership",
  outcome: "Measurable outcome",
  domain_relevance: "Industry / domain relevance",
  conflicting: "Conflicting evidence",
  missing: "Missing evidence",
};

/**
 * Weight a match type contributes toward the criterion's provisional score.
 * Higher weight ≠ higher score — the engine multiplies match confidence by
 * this weight, then averages across accepted evidence for the criterion.
 *
 * Kept deterministic (constants, not model output) so a completed score_run
 * can be reproduced from stored rubric_version + candidate_evidence_items
 * without re-calling the LLM.
 */
export const MATCH_TYPE_WEIGHTS: Record<EvidenceMatchType, number> = {
  direct: 1.0,
  semantic_equivalent: 0.9,
  outcome: 0.9,
  scale: 0.8,
  seniority: 0.8,
  transferable: 0.7,
  duration: 0.7,
  domain_relevance: 0.7,
  recency: 0.6,
  conflicting: -0.5,
  missing: 0,
};

export const SUPPORTING_ROLES = [
  "used_tool",
  "owned_delivery",
  "led_strategy",
  "observed",
  "mentioned",
] as const;
export type SupportingRole = (typeof SUPPORTING_ROLES)[number];

/**
 * Ownership depth multiplier — "led strategy around X" scores higher than
 * "used X". Kept explicit so reviewers can audit the seniority signal.
 */
export const SUPPORTING_ROLE_WEIGHTS: Record<SupportingRole, number> = {
  led_strategy: 1.0,
  owned_delivery: 0.85,
  used_tool: 0.6,
  observed: 0.3,
  mentioned: 0.15,
};

// ────────────────────────────────────────────────────────────────────────────
// Reviewer + debug vocabulary
// ────────────────────────────────────────────────────────────────────────────

export const REVIEWER_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "edited",
] as const;
export type ReviewerStatus = (typeof REVIEWER_STATUSES)[number];

export const DEBUG_EVENT_TYPES = [
  "criterion_evaluated",
  "evidence_accepted",
  "evidence_rejected",
  "rule_applied",
  "model_call",
  "retry",
  "error",
  "timing",
  "provisional_score",
  "final_score",
] as const;
export type DebugEventType = (typeof DEBUG_EVENT_TYPES)[number];

export const EVALUATION_METHODS = ["keyword", "semantic", "hybrid"] as const;
export type EvaluationMethod = (typeof EVALUATION_METHODS)[number];

// ────────────────────────────────────────────────────────────────────────────
// Weight validation helper — used by rubric builder and DB triggers.
// ────────────────────────────────────────────────────────────────────────────

export function validateDimensionWeights(
  dimensions: Array<{ key: string; weight_pct: number }>,
): { valid: boolean; total: number; error?: string } {
  const total = dimensions.reduce((sum, d) => sum + (d.weight_pct ?? 0), 0);
  if (total !== METHODOLOGY_TOTAL_WEIGHT) {
    return {
      valid: false,
      total,
      error: `Dimension weights must total ${METHODOLOGY_TOTAL_WEIGHT}. Current total: ${total}.`,
    };
  }
  const keys = new Set(dimensions.map((d) => d.key));
  if (keys.size !== dimensions.length) {
    return { valid: false, total, error: "Duplicate dimension keys." };
  }
  return { valid: true, total };
}
