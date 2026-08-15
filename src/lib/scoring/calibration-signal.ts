/**
 * Score-versus-outcome calibration signal (audit finding 12: "no calibration
 * signal"). Pure, DB-free math over already-loaded rows so it is unit
 * testable and reusable from both the admin panel and any future report.
 *
 * The engine's marketing bands promise "exceptional" at 95+, yet live scores
 * have clustered 40-67 with nothing above ~75. Nobody could see that without
 * comparing scores to what actually happened to the candidate. This module
 * computes that comparison and refuses to imply confidence the sample can't
 * support.
 */
import { SCORE_BAND_DEFS, type ScoreBand } from "@/config/scoring-bands";

/** Downstream result derived from stage / client decision / hire record. */
export type CalibrationOutcome =
  | "hired"
  | "offered"
  | "interviewed"
  | "advanced"
  | "rejected"
  | "no_decision";

/** A single completed score run joined to its downstream outcome. */
export type CalibrationRow = {
  final_score: number;
  fit_band: string | null;
  outcome: CalibrationOutcome;
};

export type ScoreBucket = {
  /** Inclusive lower bound, e.g. 40 means "40-49". */
  from: number;
  to: number;
  count: number;
};

export type BandOccupancy = {
  band: ScoreBand;
  label: string;
  min: number;
  max: number;
  produced_count: number;
  ever_produced: boolean;
};

/** Positive outcomes count toward "the engine should rank these higher". */
const POSITIVE_OUTCOMES: ReadonlySet<CalibrationOutcome> = new Set([
  "hired",
  "offered",
  "interviewed",
  "advanced",
]);
const NEGATIVE_OUTCOMES: ReadonlySet<CalibrationOutcome> = new Set(["rejected"]);

export const MIN_OUTCOMES_FOR_CONFIDENCE = 20;

export type DiscriminationSignal = {
  positive_count: number;
  negative_count: number;
  positive_mean: number | null;
  negative_mean: number | null;
  /** positive_mean - negative_mean, null when either side is empty. */
  gap: number | null;
  verdict: string;
};

export type CalibrationSignal = {
  total_scored: number;
  total_with_outcome: number;
  observed_min: number | null;
  observed_max: number | null;
  observed_median: number | null;
  buckets: ScoreBucket[];
  band_occupancy: BandOccupancy[];
  discrimination: DiscriminationSignal;
  coverage_warning: string | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** 10-point buckets from 0-100, always present even when empty. */
export function bucketScores(scores: number[]): ScoreBucket[] {
  const buckets: ScoreBucket[] = [];
  for (let from = 0; from < 100; from += 10) {
    buckets.push({ from, to: from + 9, count: 0 });
  }
  for (const score of scores) {
    const clamped = Math.max(0, Math.min(99.999, score));
    const idx = Math.min(9, Math.floor(clamped / 10));
    buckets[idx].count += 1;
  }
  return buckets;
}

/** Which configured bands have ever been produced by a real score. */
export function computeBandOccupancy(scores: number[]): BandOccupancy[] {
  return SCORE_BAND_DEFS.map((def) => {
    const produced = scores.filter((s) => s >= def.min && s <= def.max).length;
    return {
      band: def.key,
      label: def.label,
      min: def.min,
      max: def.max,
      produced_count: produced,
      ever_produced: produced > 0,
    };
  });
}

function discriminationVerdict(
  positiveCount: number,
  negativeCount: number,
  gap: number | null,
): string {
  if (positiveCount === 0 || negativeCount === 0) {
    return "Not enough hired/interviewed and rejected outcomes on record to compare — no verdict yet.";
  }
  if (gap === null) return "Not enough data to compare positive and negative outcomes.";
  if (gap >= 10) {
    return "Scores separate positive outcomes from rejections by a meaningful margin.";
  }
  if (gap > 0) {
    return "Scores show a slight lean toward higher scores among positive outcomes, not a reliable separation yet.";
  }
  return "Scores do not yet separate hired/advanced candidates from rejected candidates.";
}

/**
 * Compute the full calibration signal from rows the caller has already
 * loaded (and already scoped to real, completed score runs). No DB access
 * here — keeps this testable with plain fixtures.
 */
export function computeCalibrationSignal(rows: CalibrationRow[]): CalibrationSignal {
  const scores = rows.map((r) => r.final_score).filter((s) => Number.isFinite(s));
  const withOutcome = rows.filter((r) => r.outcome !== "no_decision");

  const positiveScores = rows
    .filter((r) => POSITIVE_OUTCOMES.has(r.outcome))
    .map((r) => r.final_score);
  const negativeScores = rows
    .filter((r) => NEGATIVE_OUTCOMES.has(r.outcome))
    .map((r) => r.final_score);

  const positiveMean = mean(positiveScores);
  const negativeMean = mean(negativeScores);
  const gap =
    positiveMean !== null && negativeMean !== null ? positiveMean - negativeMean : null;

  const discrimination: DiscriminationSignal = {
    positive_count: positiveScores.length,
    negative_count: negativeScores.length,
    positive_mean: positiveMean,
    negative_mean: negativeMean,
    gap,
    verdict: discriminationVerdict(positiveScores.length, negativeScores.length, gap),
  };

  const coverage_warning =
    withOutcome.length < MIN_OUTCOMES_FOR_CONFIDENCE
      ? `Only ${withOutcome.length} scored candidate${withOutcome.length === 1 ? "" : "s"} ${withOutcome.length === 1 ? "has" : "have"} a downstream outcome recorded (need ${MIN_OUTCOMES_FOR_CONFIDENCE}+ for a reliable read). Treat every figure below as directional, not a verdict on the scoring model.`
      : null;

  return {
    total_scored: rows.length,
    total_with_outcome: withOutcome.length,
    observed_min: scores.length ? Math.min(...scores) : null,
    observed_max: scores.length ? Math.max(...scores) : null,
    observed_median: median(scores),
    buckets: bucketScores(scores),
    band_occupancy: computeBandOccupancy(scores),
    discrimination,
    coverage_warning,
  };
}
