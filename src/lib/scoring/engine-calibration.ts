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
 *   • persisted onto the governing `rubric_versions.calibration` record, so a
 *     stored score reproduces from its rubric version plus its inputs and never
 *     from whatever this file happens to say today,
 *   • stamped onto every score run and into the input hash,
 *   • overridable per role family through ROLE_FAMILY_CALIBRATION.
 *
 * This module supplies DEFAULTS ONLY. The rubric version is the source of truth
 * for a run. Published rubric versions are immutable: changing calibration means
 * creating a new rubric version, never editing one that already governs runs.
 *
 * Bumping CALIBRATION_VERSION changes the input hash, which means existing runs
 * are not silently reinterpreted — they stay attached to their own calibration
 * and become eligible for a rescore offer instead.
 */

import { z } from "zod";
import type { EvaluationMethod } from "./evaluation-method";

/**
 * Bump whenever any value below changes. Semantic: engine-behaviour version.
 * v1.1.0 — every remaining engine literal (confidence weights, decidedness
 * ladder, snippet radius, negation windows, unreadable-CV cut) moved in here
 * and onto the rubric version.
 */
export const CALIBRATION_VERSION = "taasflow-calibration-v1.2.0";

/**
 * How the engine reaches its numbers. Recorded on every run as
 * `evaluation_method` so audits and client-facing explanations never claim a
 * model was involved when none was (audit finding 14). Canonical vocabulary
 * lives in `scoring/evaluation-method.ts` — "hybrid" is not a method.
 */
export const EVALUATION_METHOD: EvaluationMethod = "deterministic";

/**
 * Zod shape of a persisted calibration. Every field is optional on the way in
 * (a rubric version written by an older engine only carries the fields that
 * existed then) and filled from DEFAULT_CALIBRATION, so replaying an old run
 * never crashes on a field added later.
 */
export const CalibrationSchema = z.object({
  calibration_version: z.string().min(1).optional(),
  engine_version: z.string().min(1).optional(),
  role_family: z.string().nullable().optional(),

  // Credit ladder
  unknown_credit: z.number().min(0).max(1).optional(),
  partial_credit: z.number().min(0).max(1).optional(),

  // Matching
  met_keyword_ratio: z.number().min(0).max(1).optional(),
  met_keyword_floor: z.number().int().min(1).optional(),
  keyword_cap: z.number().int().min(1).optional(),
  max_evidence_per_requirement: z.number().int().min(1).optional(),
  snippet_radius_chars: z.number().int().min(10).optional(),
  max_term_hits: z.number().int().min(1).optional(),
  negation_sentence_window: z.number().int().min(10).optional(),
  negation_bare_window: z.number().int().min(5).optional(),

  // Parse quality
  thin_cv_chars: z.number().int().min(0).optional(),
  thin_cv_tokens: z.number().int().min(0).optional(),
  unreadable_cv_chars: z.number().int().min(0).optional(),

  // Caps and weights
  disqualified_cap: z.number().min(0).max(1).optional(),
  unparsed_cv_cap: z.number().min(0).max(1).optional(),
  must_have_floor: z.number().min(0).max(1).optional(),
  must_have_floor_cap: z.number().min(0).max(1).optional(),
  base_weights: z
    .object({
      must_have: z.number().min(0),
      preferred: z.number().min(0),
      screening_alignment: z.number().min(0),
    })
    .optional(),

  // Confidence
  confidence_weights: z
    .object({
      cv_length: z.number().min(0),
      evidence_volume: z.number().min(0),
      screening: z.number().min(0),
    })
    .optional(),
  confidence_cv_length_target: z.number().int().min(1).optional(),
  confidence_evidence_floor: z.number().int().min(1).optional(),
  confidence_no_screening_default: z.number().min(0).max(1).optional(),
  decidedness: z
    .object({
      met: z.number().min(0).max(1),
      contradicted: z.number().min(0).max(1),
      missing: z.number().min(0).max(1),
      partial: z.number().min(0).max(1),
      unknown: z.number().min(0).max(1),
    })
    .optional(),

  // Gates
  strong_fit: z.object({ min_must_have_coverage: z.number().min(0).max(1) }).optional(),
  manual_review_confidence: z.number().min(0).max(1).optional(),
});

export type EngineCalibration = {
  calibration_version: string;
  /** Engine build whose defaults produced this calibration. */
  engine_version: string;
  /** Role family the overrides came from, null for the base set. */
  role_family: string | null;
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
  /** Evidence snippets retained per requirement. */
  max_evidence_per_requirement: number;
  /** Characters of context kept either side of a matched term. */
  snippet_radius_chars: number;
  /** Occurrences of a single term the matcher bothers to locate. */
  max_term_hits: number;
  /** Characters before a mention scanned for negation phrases. */
  negation_sentence_window: number;
  /** Tighter window used for bare negators ("no", "never"). */
  negation_bare_window: number;
  /** Below this many characters a CV is treated as unparsed, not negative. */
  thin_cv_chars: number;
  /** Below this many distinct tokens a CV is treated as unparsed. */
  thin_cv_tokens: number;
  /** Below this the CV text is unusable: band becomes `unknown`, not `not_a_fit`. */
  unreadable_cv_chars: number;
  /** Hard ceiling (0-1) once a disqualifying screening answer is present. */
  disqualified_cap: number;
  /**
   * Hard ceiling (0-1) when the CV text could not be extracted. An unparsed CV
   * is an evidence failure, so the run must not publish a confident number.
   */
  unparsed_cv_cap: number;
  /** Must-have coverage (0-1) below which the composite is capped. */
  must_have_floor: number;
  /** Ceiling (0-1) applied when must-have coverage sits below the floor. */
  must_have_floor_cap: number;
  /** Base category weights before absent categories are dropped. */
  base_weights: { must_have: number; preferred: number; screening_alignment: number };
  /** Weights of the three overall-confidence components (sum to 1). */
  confidence_weights: { cv_length: number; evidence_volume: number; screening: number };
  /** CV length at which the length component of confidence saturates. */
  confidence_cv_length_target: number;
  /** Minimum denominator for the evidence-volume component. */
  confidence_evidence_floor: number;
  /** Screening component when a role asks no screening questions. */
  confidence_no_screening_default: number;
  /** How decided each requirement status is, for evidence confidence. */
  decidedness: {
    met: number;
    contradicted: number;
    missing: number;
    partial: number;
    unknown: number;
  };
  /**
   * Must-have coverage required before a score-derived `strong_fit` band is
   * allowed. Numeric band cut-offs live in src/lib/scoring/bands.ts — this is
   * the only fit gate the calibration still owns.
   */
  strong_fit: { min_must_have_coverage: number };
  /** Below this confidence a run is routed to human review, never published. */
  manual_review_confidence: number;
};

/**
 * Canonical calibration. Every value carries its reason so a later reviewer can
 * argue with the choice instead of guessing at it.
 */
export const DEFAULT_CALIBRATION: EngineCalibration = {
  calibration_version: CALIBRATION_VERSION,
  engine_version: "taasflow-scoring-v1.2.0",
  role_family: null,
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
  // Two snippets are enough for a reviewer to judge; more is scroll fatigue.
  max_evidence_per_requirement: 2,
  // Roughly one line either side of the hit — enough to read the claim.
  snippet_radius_chars: 80,
  // A term repeated more than five times adds no new information.
  max_term_hits: 5,
  // Negation phrases sit within a clause of the mention.
  negation_sentence_window: 70,
  // Bare negators are common in prose, so they must be adjacent to count.
  negation_bare_window: 25,
  // Below this, extraction has effectively failed; concluding "missing" would
  // punish the candidate for our parser.
  thin_cv_chars: 300,
  thin_cv_tokens: 40,
  // Under 60 characters there is no document to assess at all.
  unreadable_cv_chars: 60,
  // A dealbreaker answer must dominate the composite, but the run stays
  // readable rather than collapsing to zero.
  disqualified_cap: 0.15,
  // An unparsed CV means we assessed nothing; the run stays low and routes to
  // review rather than presenting a confident composite.
  unparsed_cv_cap: 0.3,
  // Below 40% of the must-haves evidenced, the role's core is unproven, so the
  // composite cannot present as better than a partial fit.
  must_have_floor: 0.4,
  must_have_floor_cap: 0.5,
  base_weights: { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 },
  // Length and evidence volume carry equal weight; screening completeness is a
  // supporting signal, not the main one.
  confidence_weights: { cv_length: 0.4, evidence_volume: 0.4, screening: 0.2 },
  confidence_cv_length_target: 800,
  confidence_evidence_floor: 3,
  confidence_no_screening_default: 0.5,
  // A met or contradicted requirement is fully decided; "missing" is nearly so
  // (we read a real CV and found nothing); "unknown" is undecided by definition.
  decidedness: { met: 1, contradicted: 1, missing: 0.8, partial: 0.6, unknown: 0 },
  strong_fit: { min_must_have_coverage: 0.75 },
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
    role_family: key,
    base_weights: delta.base_weights ?? DEFAULT_CALIBRATION.base_weights,
  };
}

/**
 * Rehydrate a calibration persisted on a rubric version. Unknown/missing fields
 * fall back to today's defaults, so an old rubric version still replays; every
 * field it DOES carry wins over the default, so a historical run reproduces its
 * own numbers rather than the current ones.
 */
export function parseCalibration(raw: unknown): EngineCalibration {
  const parsed = CalibrationSchema.safeParse(raw ?? {});
  const v = parsed.success ? parsed.data : {};
  return {
    ...DEFAULT_CALIBRATION,
    ...v,
    calibration_version: v.calibration_version ?? DEFAULT_CALIBRATION.calibration_version,
    engine_version: v.engine_version ?? DEFAULT_CALIBRATION.engine_version,
    role_family: v.role_family ?? null,
    base_weights: v.base_weights ?? DEFAULT_CALIBRATION.base_weights,
    confidence_weights: v.confidence_weights ?? DEFAULT_CALIBRATION.confidence_weights,
    decidedness: v.decidedness ?? DEFAULT_CALIBRATION.decidedness,
    strong_fit: v.strong_fit ?? DEFAULT_CALIBRATION.strong_fit,
  };
}

/** Serialise for storage on a rubric version. */
export function serialiseCalibration(c: EngineCalibration): Record<string, unknown> {
  return { ...c } as Record<string, unknown>;
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
    { label: "Unparsed CV cap", value: `${Math.round(c.unparsed_cv_cap * 100)}/100` },
    {
      label: "Must-have floor",
      value: `below ${Math.round(c.must_have_floor * 100)}% coverage caps at ${Math.round(c.must_have_floor_cap * 100)}/100`,
    },
    {
      label: "Weights",
      value: `must-have ${c.base_weights.must_have}, preferred ${c.base_weights.preferred}, screening ${c.base_weights.screening_alignment}`,
    },
    {
      label: "Confidence mix",
      value: `CV length ${c.confidence_weights.cv_length}, evidence ${c.confidence_weights.evidence_volume}, screening ${c.confidence_weights.screening}`,
    },
    { label: "Manual review below", value: c.manual_review_confidence.toFixed(2) },
  ];
}
