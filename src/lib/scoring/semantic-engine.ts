/**
 * Semantic evidence evaluation engine — replaces keyword-only scoring.
 *
 * Deterministic reproduction contract (Prompt 3 acceptance):
 *   score = f(rubric_version.blueprint, candidate_evidence_items[])
 *
 * Given the same rubric version and the same accepted evidence items,
 * the same final score comes out — no LLM re-call needed. LLMs propose
 * evidence items (with match_type, confidence, source_passage). This
 * engine turns those items into deterministic per-criterion and
 * per-dimension scores using the constants in `rubric-constants.ts`.
 *
 * Server-only. Never expose the debug trace to clients or candidates —
 * `scoring_debug_events` RLS enforces that at the DB layer too.
 */

import {
  ANCHOR_SCALE,
  CLASSIFICATION_BEHAVIOR,
  MATCH_TYPE_WEIGHTS,
  METHODOLOGY_TOTAL_WEIGHT,
  SUPPORTING_ROLE_WEIGHTS,
  type AnchorStrength,
  type CriterionClassification,
  type EvidenceMatchType,
  type SupportingRole,
} from "./rubric-constants";

export type EvidenceItem = {
  id?: string;
  rubric_criterion_key: string;
  rubric_dimension_key: string;
  match_type: EvidenceMatchType;
  confidence: number;
  supporting_role: SupportingRole | null;
  reviewer_status: "pending" | "accepted" | "rejected" | "edited";
};

export type RubricCriterion = {
  key: string;
  name: string;
  dimension_key: string;
  weight_pct_within_dimension: number;
  classification: CriterionClassification;
};

export type RubricDimension = {
  key: string;
  name: string;
  weight_pct: number;
  criteria: RubricCriterion[];
};

export type RubricBlueprint = {
  dimensions: RubricDimension[];
};

export type CriterionScore = {
  criterion_key: string;
  dimension_key: string;
  classification: CriterionClassification;
  score: number; // 0–100
  anchor: AnchorStrength;
  accepted_evidence_count: number;
  conflicting_evidence_count: number;
  missing: boolean;
  reasoning: string;
};

export type DimensionScore = {
  dimension_key: string;
  weighted_score: number; // criterion_score × weight_pct_within_dimension
  raw_score: number; // pre-weighting average across weighted criteria
  criterion_scores: CriterionScore[];
};

export type SemanticScoreResult = {
  final_score: number; // 0–100
  raw_score: number;
  /** Ceiling that fired, or null when no cap applied to this run. */
  applied_cap: number | null;
  dimension_scores: DimensionScore[];
  qualifiers_passed: boolean;
  disqualifiers_triggered: string[];
  must_haves_missing: string[];
  reproducibility_hash: string;
};

// Deterministic hash for reproducibility audit trails.
function computeReproducibilityHash(
  blueprintVersion: string,
  items: EvidenceItem[],
): string {
  const parts = [blueprintVersion];
  const sorted = [...items]
    .filter((i) => i.reviewer_status !== "rejected")
    .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
  for (const it of sorted) {
    parts.push(
      `${it.rubric_criterion_key}|${it.match_type}|${it.confidence.toFixed(3)}|${it.supporting_role ?? ""}|${it.reviewer_status}`,
    );
  }
  // Simple stable string digest; DB stores this alongside the score_run.
  let hash = 0;
  const s = parts.join("::");
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return `rh_${Math.abs(hash).toString(36)}`;
}

function anchorForScore(score: number): AnchorStrength {
  if (score <= ANCHOR_SCALE.weak.score_max) return "weak";
  if (score <= ANCHOR_SCALE.partial.score_max) return "partial";
  return "strong";
}

/**
 * Score one criterion from its accepted evidence.
 *
 * Rule set (deterministic — never call an LLM here):
 *   1. Filter to items for this criterion where reviewer_status !== 'rejected'.
 *   2. For each item: contribution = confidence × MATCH_TYPE_WEIGHTS[match_type]
 *                                    × SUPPORTING_ROLE_WEIGHTS[supporting_role ?? 'used_tool']
 *   3. Aggregate: average contribution across accepted items (0–1), then × 100.
 *   4. Conflicting evidence (negative weight) pulls the score down but cannot
 *      go below 0.
 *   5. No accepted evidence + no conflicting evidence → 0 (missing), NOT
 *      a keyword-absent zero. The "missing" flag distinguishes the two.
 *   6. A criterion with ANY direct or semantic_equivalent evidence at
 *      confidence ≥ 0.5 receives a floor of 34 (partial anchor) — this is
 *      the "never irrational zero" acceptance rule from Prompt 3.
 */
function scoreCriterion(
  criterion: RubricCriterion,
  itemsForCriterion: EvidenceItem[],
): CriterionScore {
  const usable = itemsForCriterion.filter(
    (i) => i.reviewer_status !== "rejected",
  );
  const accepted = usable.filter((i) => i.match_type !== "missing");
  const conflicting = usable.filter((i) => i.match_type === "conflicting");

  if (accepted.length === 0) {
    return {
      criterion_key: criterion.key,
      dimension_key: criterion.dimension_key,
      classification: criterion.classification,
      score: 0,
      anchor: "weak",
      accepted_evidence_count: 0,
      conflicting_evidence_count: conflicting.length,
      missing: true,
      reasoning:
        "No supporting evidence found. Reviewer should mark 'missing' or add evidence before publishing.",
    };
  }

  let contributionSum = 0;
  for (const it of accepted) {
    const matchWeight = MATCH_TYPE_WEIGHTS[it.match_type] ?? 0;
    const roleWeight = SUPPORTING_ROLE_WEIGHTS[it.supporting_role ?? "used_tool"];
    contributionSum += Math.max(-1, Math.min(1, it.confidence)) * matchWeight * roleWeight;
  }
  let averaged = contributionSum / accepted.length;

  // Conflicting evidence pulls the criterion down.
  for (const c of conflicting) {
    averaged += MATCH_TYPE_WEIGHTS.conflicting * c.confidence * 0.5;
  }

  let score = Math.round(Math.max(0, Math.min(1, averaged)) * 100);

  // "Never irrational zero" floor — strong direct/semantic evidence anchors at partial.
  const hasStrongSemanticMatch = accepted.some(
    (i) =>
      (i.match_type === "direct" || i.match_type === "semantic_equivalent") &&
      i.confidence >= 0.5,
  );
  if (hasStrongSemanticMatch && score < 34) {
    score = 34;
  }

  return {
    criterion_key: criterion.key,
    dimension_key: criterion.dimension_key,
    classification: criterion.classification,
    score,
    anchor: anchorForScore(score),
    accepted_evidence_count: accepted.length,
    conflicting_evidence_count: conflicting.length,
    missing: false,
    reasoning:
      `Aggregated ${accepted.length} accepted item(s)` +
      (conflicting.length ? `, ${conflicting.length} conflicting` : "") +
      (hasStrongSemanticMatch && score === 34
        ? "; anchored at partial floor due to strong direct/semantic evidence"
        : ""),
  };
}

export function evaluateSemanticScore(input: {
  blueprint: RubricBlueprint;
  blueprintVersion: string;
  evidenceItems: EvidenceItem[];
}): SemanticScoreResult {
  const { blueprint, evidenceItems } = input;

  // Bucket evidence by criterion once.
  const byCriterion = new Map<string, EvidenceItem[]>();
  for (const item of evidenceItems) {
    const key = item.rubric_criterion_key;
    if (!byCriterion.has(key)) byCriterion.set(key, []);
    byCriterion.get(key)!.push(item);
  }

  const dimensionScores: DimensionScore[] = [];
  const disqualifiers_triggered: string[] = [];
  const must_haves_missing: string[] = [];
  let qualifiers_passed = true;

  for (const dimension of blueprint.dimensions) {
    const criterionScores: CriterionScore[] = [];
    let weightedInDimension = 0;
    let totalDimensionWeight = 0;

    for (const criterion of dimension.criteria) {
      const items = byCriterion.get(criterion.key) ?? [];
      const cs = scoreCriterion(criterion, items);
      criterionScores.push(cs);

      const behavior = CLASSIFICATION_BEHAVIOR[criterion.classification];

      // Qualifiers / disqualifiers act as gates — they don't contribute weight.
      if (criterion.classification === "disqualifier") {
        if (cs.accepted_evidence_count > 0 && !cs.missing) {
          disqualifiers_triggered.push(criterion.key);
        }
        continue;
      }
      if (criterion.classification === "qualifier") {
        if (cs.missing) qualifiers_passed = false;
        continue;
      }
      if (criterion.classification === "must_have" && cs.missing) {
        must_haves_missing.push(criterion.key);
      }

      if (behavior.weighted) {
        weightedInDimension +=
          cs.score * (criterion.weight_pct_within_dimension / 100);
        totalDimensionWeight += criterion.weight_pct_within_dimension;
      }
    }

    // Normalize inside dimension if criterion weights don't total 100.
    const rawDimensionScore =
      totalDimensionWeight > 0
        ? Math.round((weightedInDimension * 100) / totalDimensionWeight)
        : 0;

    dimensionScores.push({
      dimension_key: dimension.key,
      raw_score: rawDimensionScore,
      weighted_score: Math.round(
        rawDimensionScore * (dimension.weight_pct / METHODOLOGY_TOTAL_WEIGHT),
      ),
      criterion_scores: criterionScores,
    });
  }

  const raw_score = dimensionScores.reduce(
    (sum, d) => sum + d.weighted_score,
    0,
  );

  // Caps: any disqualifier caps at 0; failing qualifier caps at 34 (weak).
  // Null means "no cap defined for this run" — recording 100 would be a
  // meaningless value indistinguishable from a real ceiling.
  let applied_cap: number | null = null;
  if (disqualifiers_triggered.length > 0) applied_cap = 0;
  else if (!qualifiers_passed) applied_cap = 33;
  else if (must_haves_missing.length > 0) applied_cap = 66; // must-have gaps cap at partial

  const final_score = applied_cap === null ? raw_score : Math.min(raw_score, applied_cap);

  return {
    final_score,
    raw_score,
    applied_cap,
    dimension_scores: dimensionScores,
    qualifiers_passed,
    disqualifiers_triggered,
    must_haves_missing,
    reproducibility_hash: computeReproducibilityHash(
      input.blueprintVersion,
      evidenceItems,
    ),
  };
}
