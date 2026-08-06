/**
 * Engine calibration — the documented, versioned home for every number the
 * deterministic scoring engine used to hardcode in its body.
 *
 * Why this file exists (audit finding 10): constants such as "unknown credits
 * 0.4", "met at 60% of keywords", "cap keywords at 12", "a CV under 300 chars
 * is thin", "a disqualifying answer caps at 0.15" were embedded in the engine
 * with no provenance. Nothing said who chose them, whether they had been
 * reviewed, or how a role family could differ. They are now:
 *
 *   • named and documented with the rationale for the value,
 *   • versioned via CALIBRATION_VERSION (bump on ANY value change),
 *   • stamped onto every score run and into the input hash, so a stored score
 *     can be reproduced against the exact calibration that produced it,
 *   • overridable per role family through ROLE_FAMILY_CALIBRATION.
 *
 * Bumping CALIBRATION_VERSION changes the input hash, which means existing runs
 * are not silently reinterpreted — they stay attached to their own calibration
 * and become eligible for a rescore offer instead.
 */

/** Bump whenever any value below changes. Semantic: engine-behaviour version. */
export const CALIBRATION_VERSION = "taasflow-calibration-v1.0.0";

/**
 * How the engine reaches its numbers. Recorded on every run as
 * `evaluation_method` so audits and client-facing explanations never claim a
 * model was involved when none was (audit finding 14).
 */
export const EVALUATION_METHOD = "deterministic_keyword" as const;

export type EngineCalibration = {
  calibration_version: string;
  /** Credit given to a requirement whose status is `unknown`. */
  unknown_credit: number;
  /** Credit for `partial`. */
  partial_credit: number;
  /** Share of a requirement's keywords that must match for `met`. */
  met_keyword_ratio: number;
  /** Absolute floor of matched keywords for `met` on short requirements. */
  met_keyword_floor: number;
  /** Max auto-extracted keywords kept per requirement. */
  keyword_cap: number;
  /** Below this many characters a CV is treated as unparsed, not negative. */
  thin_cv_chars: number;
  /** Below this many distinct tokens a CV is treated as unparsed. */
  thin_cv_tokens: number;
  /** Hard ceiling (0-1) once a disqualifying screening answer is present. */
  disqualified_cap: number;
  /** Base category weights before absent categories are dropped. */
  base_weights: { must_have: number; preferred: number; screening_alignment: number };
  /** Score (0-100) + must-have coverage required for `strong_fit`. */
  strong_fit: { min_score: number; min_must_have_coverage: number };
  /** Score (0-100) required for `worth_considering`. */
  worth_considering_min_score: number;
  /** Below this confidence a run is routed to human review, never published. */
  manual_review_confidence: number;
};

/**
 * Canonical calibration. Every value carries its reason so a later reviewer can
 * argue with the choice instead of guessing at it.
 */
export const DEFAULT_CALIBRATION: EngineCalibration = {
  calibration_version: CALIBRATION_VERSION,
  // Absent evidence is an information gap, not a negative finding. 0.4 sits
  // just below `partial` so an unvalidated requirement can never outrank one
  // with real evidence.
  unknown_credit: 0.4,
  partial_credit: 0.5,
  // A requirement line usually yields several keywords; demanding a clear
  // majority avoids crediting a single incidental token.
  met_keyword_ratio: 0.6,
  met_keyword_floor: 2,
  // Long requirement prose degenerates into noise past a dozen terms.
  keyword_cap: 12,
  // Below this, extraction has effectively failed; concluding "missing" would
  // punish the candidate for our parser.
  thin_cv_chars: 300,
  thin_cv_tokens: 40,
  // A dealbreaker answer must dominate the composite, but the run stays
  // readable rather than collapsing to zero.
  disqualified_cap: 0.15,
  base_weights: { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 },
  strong_fit: { min_score: 75, min_must_have_coverage: 0.75 },
  worth_considering_min_score: 55,
  manual_review_confidence: 0.35,
};

/**
 * Role-family deltas. Deliberately sparse: a family only appears when there is
 * a stated reason for it to differ. Anything absent uses DEFAULT_CALIBRATION.
 */
export const ROLE_FAMILY_CALIBRATION: Record<string, Partial<EngineCalibration>> = {
  // Engineering CVs list stacks densely, so a majority-of-keywords rule is too
  // easy; require more of the requirement to be evidenced.
  engineering: { met_keyword_ratio: 0.7, keyword_cap: 14 },
  // Hospitality CVs are short by convention — a two-page threshold would mark
  // most of them unparsed.
  hospitality: { thin_cv_chars: 200, thin_cv_tokens: 30 },
  // Regulated healthcare roles hinge on hard credentials; screening answers
  // carry more of the decision than free-text CV overlap.
  healthcare: { base_weights: { must_have: 0.6, preferred: 0.1, screening_alignment: 0.3 } },
};

export type RoleFamily = keyof typeof ROLE_FAMILY_CALIBRATION | string;

/** Resolve the calibration in force for a role family. */
export function resolveCalibration(roleFamily?: string | null): EngineCalibration {
  const key = (roleFamily ?? "").trim().toLowerCase();
  const delta = key ? ROLE_FAMILY_CALIBRATION[key] : undefined;
  if (!delta) return DEFAULT_CALIBRATION;
  return {
    ...DEFAULT_CALIBRATION,
    ...delta,
    // Never inherit the base version when values were altered.
    calibration_version: `${CALIBRATION_VERSION}+${key}`,
    base_weights: delta.base_weights ?? DEFAULT_CALIBRATION.base_weights,
  };
}

/** Human-readable provenance lines for admin surfaces. */
export function calibrationProvenance(c: EngineCalibration): Array<{ label: string; value: string }> {
  return [
    { label: "Calibration", value: c.calibration_version },
    { label: "Method", value: "Deterministic keyword and screening matching — no model call" },
    { label: "Unknown evidence credit", value: c.unknown_credit.toFixed(2) },
    { label: "Met threshold", value: `${Math.round(c.met_keyword_ratio * 100)}% of terms (min ${c.met_keyword_floor})` },
    { label: "Keyword cap", value: String(c.keyword_cap) },
    { label: "Thin CV cut", value: `${c.thin_cv_chars} chars / ${c.thin_cv_tokens} tokens` },
    { label: "Disqualified cap", value: `${Math.round(c.disqualified_cap * 100)}/100` },
    {
      label: "Weights",
      value: `must-have ${c.base_weights.must_have}, preferred ${c.base_weights.preferred}, screening ${c.base_weights.screening_alignment}`,
    },
  ];
}
