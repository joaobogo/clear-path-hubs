/**
 * Milestone timing statistics — pure, deterministic, and sample-size honest.
 *
 * Rules that the reporting surface depends on:
 * - A median is only reported when at least MIN_SAMPLE completed instances
 *   exist. Below that we report the sample size and suppress the figure
 *   entirely — no averages, no caveated small numbers.
 * - Quartiles use the nearest-rank method on the sorted sample, so the same
 *   input always produces the same output (no interpolation drift).
 * - No benchmarks, targets, or comparisons to anything outside this data.
 */

export const MIN_SAMPLE = 5;

export const MILESTONES = [
  { key: "intake_to_first_submission", label: "Intake to first submission" },
  { key: "submission_to_decision", label: "Submission to client decision" },
  { key: "decision_to_interview", label: "Decision to interview" },
  { key: "interview_to_offer", label: "Interview to offer" },
  { key: "offer_to_start", label: "Offer to start" },
] as const;

export type MilestoneKey = (typeof MILESTONES)[number]["key"];

export type MilestoneStat = {
  key: MilestoneKey;
  label: string;
  /** Number of completed instances in the period. Always reported. */
  sample: number;
  /** Null when the sample is below MIN_SAMPLE — suppressed, not estimated. */
  median_days: number | null;
  p25_days: number | null;
  p75_days: number | null;
  suppressed: boolean;
};

/** Nearest-rank quantile on an already-sorted ascending array. */
function quantile(sorted: number[], q: number): number {
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[rank]!;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarize(key: MilestoneKey, label: string, values: number[]): MilestoneStat {
  const clean = values
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  const sample = clean.length;
  if (sample < MIN_SAMPLE) {
    return { key, label, sample, median_days: null, p25_days: null, p75_days: null, suppressed: true };
  }
  return {
    key,
    label,
    sample,
    median_days: round1(quantile(clean, 0.5)),
    p25_days: round1(quantile(clean, 0.25)),
    p75_days: round1(quantile(clean, 0.75)),
    suppressed: false,
  };
}

export type TimingSegment = {
  /** Stable id for drill-through: organization id or role family slug. */
  id: string;
  label: string;
  stats: MilestoneStat[];
  /** Total completed instances across all milestones in this segment. */
  total_instances: number;
  position_ids: string[];
};

export function buildSegment(
  id: string,
  label: string,
  values: Record<MilestoneKey, number[]>,
  positionIds: string[],
): TimingSegment {
  const stats = MILESTONES.map((m) => summarize(m.key, m.label, values[m.key] ?? []));
  return {
    id,
    label,
    stats,
    total_instances: stats.reduce((sum, s) => sum + s.sample, 0),
    position_ids: [...new Set(positionIds)],
  };
}

export function emptyValues(): Record<MilestoneKey, number[]> {
  return {
    intake_to_first_submission: [],
    submission_to_decision: [],
    decision_to_interview: [],
    interview_to_offer: [],
    offer_to_start: [],
  };
}

export function formatDays(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}
