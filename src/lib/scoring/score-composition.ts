/**
 * Score composition — the three published weightings behind a fit score.
 *
 * The engine scores a candidate as a weighted sum of three measured shares:
 *   must-have coverage (60%), nice-to-have signal (20%), screening alignment (20%).
 *
 * This module turns the stored run into that arithmetic so a recruiter can read
 * "why 88?" and add the three contributions up themselves. Nothing is invented:
 * when the run did not store a share, its component is omitted and the panel
 * says the composition is incomplete rather than filling a gap with a guess.
 */

export type ScoreComponentKey = "must_have" | "preferred" | "screening_alignment";

export type ScoreComponent = {
  key: ScoreComponentKey;
  label: string;
  /** Measured share for this candidate, 0–100. */
  valuePct: number;
  /** Published weighting of this component, 0–100. */
  weightPct: number;
  /** valuePct × weight, in points of the final score. */
  contributionPts: number;
};

export type ScoreComposition = {
  components: ScoreComponent[];
  /** Sum of the contributions, rounded the same way the score is. */
  totalPts: number;
  /** The score actually shown to the client, when there is one. */
  displayedScore: number | null;
  /** True when the three contributions reproduce the displayed score. */
  reconciles: boolean;
  /** True when one or more shares were not stored by the run. */
  incomplete: boolean;
};

const LABELS: Record<ScoreComponentKey, string> = {
  must_have: "Must-have coverage",
  preferred: "Nice-to-have signal",
  screening_alignment: "Screening alignment",
};

/** Published weightings. The run's own weights win when it stored them. */
export const DEFAULT_WEIGHTS: Record<ScoreComponentKey, number> = {
  must_have: 0.6,
  preferred: 0.2,
  screening_alignment: 0.2,
};

const KEYS: ScoreComponentKey[] = ["must_have", "preferred", "screening_alignment"];

function share(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Shares are stored as 0–1 fractions; a value above 1 is already a percentage.
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Build the composition from the stored requirement coverage (preferred) or the
 * run result, whichever carries the measured shares.
 */
export function buildScoreComposition(input: {
  coverage: Record<string, unknown> | null | undefined;
  result: Record<string, unknown> | null | undefined;
  displayedScore: number | null | undefined;
}): ScoreComposition | null {
  const cov = (input.coverage ?? {}) as Record<string, any>;
  const res = (input.result ?? {}) as Record<string, any>;
  const breakdown = (res.category_breakdown ?? {}) as Record<string, any>;

  const weightSource =
    (cov.category_weights as Record<string, any> | undefined) ??
    (res.category_weights as Record<string, any> | undefined) ??
    null;

  const components: ScoreComponent[] = [];
  let incomplete = false;

  for (const key of KEYS) {
    const valuePct =
      share(cov[key]) ??
      share(key === "must_have" ? cov.must_have_coverage : undefined) ??
      share(breakdown[key]);
    const weightPct = share(weightSource?.[key]) ?? DEFAULT_WEIGHTS[key] * 100;
    if (valuePct == null) {
      incomplete = true;
      continue;
    }
    components.push({
      key,
      label: LABELS[key],
      valuePct: Math.round(valuePct * 10) / 10,
      weightPct: Math.round(weightPct),
      contributionPts: Math.round(((valuePct * weightPct) / 100) * 10) / 10,
    });
  }

  if (components.length === 0) return null;

  const totalPts =
    Math.round(components.reduce((sum, c) => sum + c.contributionPts, 0) * 10) / 10;
  const displayedScore =
    typeof input.displayedScore === "number" && Number.isFinite(input.displayedScore)
      ? Math.round(input.displayedScore)
      : null;

  return {
    components,
    totalPts,
    displayedScore,
    reconciles:
      !incomplete &&
      displayedScore != null &&
      Math.abs(Math.round(totalPts) - displayedScore) <= 1,
    incomplete,
  };
}

/**
 * Weighted requirement basis — the counts behind a coverage percentage.
 *
 * Each declared requirement is worth one point; a partly met requirement is
 * worth half. This is the arithmetic the requirement panel already shows, so
 * the composition panel can print "91.7% (5.5 of 6 weighted points)" without
 * inventing a second calculation.
 */
export type RequirementBasis = {
  points: number;
  max: number;
  met: number;
  partial: number;
  missing: number;
  total: number;
  /** points / max as a 0–100 percentage, rounded to one decimal. */
  valuePct: number;
};

export function requirementBasis(
  rows: Array<{ status: string; importance?: string }>,
  importance: "must_have" | "preferred",
): RequirementBasis | null {
  const scoped = rows.filter((r) =>
    importance === "must_have"
      ? r.importance === "must_have"
      : r.importance !== "must_have",
  ).filter((r) => r.status !== "not_applicable");
  const total = scoped.length;
  if (total === 0) return null;
  const met = scoped.filter((r) => r.status === "met").length;
  const partial = scoped.filter((r) => r.status === "partial").length;
  const missing = total - met - partial;
  const points = Math.round((met + partial * 0.5) * 10) / 10;
  return {
    points,
    max: total,
    met,
    partial,
    missing,
    total,
    valuePct: Math.round((points / total) * 1000) / 10,
  };
}

/** "5.5 of 6 weighted points" — the counts a percentage is made of. */
export function formatBasis(b: RequirementBasis): string {
  const pts = Number.isInteger(b.points) ? b.points.toFixed(0) : b.points.toFixed(1);
  return `${pts} of ${b.max} weighted points`;
}
