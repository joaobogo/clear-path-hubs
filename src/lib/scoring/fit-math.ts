/**
 * Fit math (Prompt 5).
 *
 *  criterion_score  : 0..100 (anchor-based, from evidence)
 *  dimension_score  : weighted average across APPLICABLE criteria only
 *                     Not Applicable and Unknown-without-evidence criteria
 *                     are REMOVED from the denominator, not zeroed.
 *  fit_score        : Σ dimension_score * (dimension_weight_pct / 100)
 *
 * Precision:
 *  - Internal math keeps 4 decimal places.
 *  - Client-facing display uses whole numbers (see displayScore).
 */

export type CriterionInput = {
  key: string;
  /** Score anchored 0..100 from evidence. null when no evaluable evidence. */
  score: number | null;
  /** Relative weight within its dimension. 0 or missing -> excluded. */
  weight?: number;
  /** True when the criterion is explicitly N/A for this candidate/position. */
  not_applicable?: boolean;
  /** Evidence confidence for this specific criterion, 0..100. */
  confidence?: number | null;
};

export type DimensionInput = {
  key: string;
  weight_pct: number; // 0..100
  criteria: CriterionInput[];
};

export type DimensionResult = {
  key: string;
  weight_pct: number;
  applicable_count: number;
  excluded_count: number;
  score: number | null; // null when nothing applicable
  confidence: number | null; // avg evidence confidence across applicable
};

export type FitResult = {
  fit_score: number | null; // 0..100 with 4dp internally, null if no data
  fit_score_display: number | null; // whole number for UI
  applied_weight: number; // sum of weights actually used (excludes empty dims)
  dimensions: DimensionResult[];
  evidence_confidence: number | null; // weighted avg confidence 0..100
};

const round = (n: number, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export function computeDimension(dim: DimensionInput): DimensionResult {
  const applicable = dim.criteria.filter(
    (c) =>
      !c.not_applicable &&
      c.score !== null &&
      c.score !== undefined &&
      Number.isFinite(c.score) &&
      (c.weight ?? 1) > 0,
  );
  const excluded = dim.criteria.length - applicable.length;

  if (applicable.length === 0) {
    return {
      key: dim.key,
      weight_pct: dim.weight_pct,
      applicable_count: 0,
      excluded_count: excluded,
      score: null,
      confidence: null,
    };
  }
  const totalW = applicable.reduce((s, c) => s + (c.weight ?? 1), 0);
  const weighted =
    applicable.reduce((s, c) => s + (c.score as number) * (c.weight ?? 1), 0) /
    totalW;

  const confSamples = applicable
    .map((c) => c.confidence)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const conf =
    confSamples.length === 0
      ? null
      : round(confSamples.reduce((a, b) => a + b, 0) / confSamples.length, 2);

  return {
    key: dim.key,
    weight_pct: dim.weight_pct,
    applicable_count: applicable.length,
    excluded_count: excluded,
    score: round(Math.max(0, Math.min(100, weighted))),
    confidence: conf,
  };
}

export function computeFit(dims: DimensionInput[]): FitResult {
  const dimResults = dims.map(computeDimension);
  const evaluable = dimResults.filter((d) => d.score !== null);

  if (evaluable.length === 0) {
    return {
      fit_score: null,
      fit_score_display: null,
      applied_weight: 0,
      dimensions: dimResults,
      evidence_confidence: null,
    };
  }

  const appliedWeight = evaluable.reduce((s, d) => s + d.weight_pct, 0);
  // Weighted average: rebase over applied weight so removing an entire N/A
  // dimension does not deflate the total (denominator stays honest).
  const numerator = evaluable.reduce(
    (s, d) => s + (d.score as number) * d.weight_pct,
    0,
  );
  const fit = appliedWeight === 0 ? null : numerator / appliedWeight;

  // Weighted confidence: only dimensions that actually contributed
  const confDims = evaluable.filter((d) => d.confidence !== null);
  const confWeight = confDims.reduce((s, d) => s + d.weight_pct, 0);
  const confidence =
    confWeight === 0
      ? null
      : round(
          confDims.reduce(
            (s, d) => s + (d.confidence as number) * d.weight_pct,
            0,
          ) / confWeight,
          2,
        );

  return {
    fit_score: fit === null ? null : round(Math.max(0, Math.min(100, fit))),
    fit_score_display: fit === null ? null : Math.round(fit),
    applied_weight: appliedWeight,
    dimensions: dimResults,
    evidence_confidence: confidence,
  };
}
