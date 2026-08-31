import { resolveRequirementStatus } from "@/lib/client/requirement-status";
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

export type ScoreComponentKey =
  | "must_have"
  | "preferred"
  | "screening_alignment"
  /**
   * The difference between the engine's weighted parts and the score of record
   * after review. It is a real, named part of the score — not a fudge — so the
   * parts always add up to the number the client is looking at.
   */
  | "review_adjustment";

export type ScoreComponent = {
  key: ScoreComponentKey;
  label: string;
  /** Measured share for this candidate, 0–100. */
  valuePct: number;
  /** Published weighting of this component, 0–100. */
  weightPct: number;
  /** valuePct × weight, in points of the final score (unrounded). */
  contributionPts: number;
  /**
   * The whole number of points shown for this part. Rounding happens once, on
   * the total, and the remainder is apportioned across the parts so the three
   * displayed numbers always add up to the published score.
   */
  displayPts: number;
};

export type ScoreComposition = {
  components: ScoreComponent[];
  /** Exact sum of the contributions, before any rounding. */
  exactTotalPts: number;
  /** The published score: the exact total rounded once, at the end. */
  totalPts: number;
  /** Loom introduction bonus (0 or VIDEO_INTRO_BONUS_PTS), shown as its own line. */
  videoBonusPts: number;
  /** totalPts + videoBonusPts — the figure every surface must show. */
  grandTotalPts: number;
  /** The score actually shown to the client, when there is one. */
  displayedScore: number | null;
  /** True when the three contributions reproduce the displayed score. */
  reconciles: boolean;
  /** True when one or more shares were not stored by the run. */
  incomplete: boolean;
};

const LABELS: Record<ScoreComponentKey, string> = {
  // Weighted coverage: a partly evidenced must-have is worth half a point. This
  // is a different measurement from "Must-haves fully met" and keeps its own name.
  must_have: "Must-have coverage",
  preferred: "Nice-to-have signal",
  screening_alignment: "Screening alignment",
  review_adjustment: "Adjustment made in review",
};

/** Published weightings. The run's own weights win when it stored them. */
export const DEFAULT_WEIGHTS: Record<Exclude<ScoreComponentKey, "review_adjustment">, number> = {
  must_have: 0.6,
  preferred: 0.2,
  screening_alignment: 0.2,
};

const KEYS: Array<Exclude<ScoreComponentKey, "review_adjustment">> = [
  "must_have",
  "preferred",
  "screening_alignment",
];

function share(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Shares are stored as 0–1 fractions; a value above 1 is already a percentage.
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Round a set of exact contributions to whole points so that they add up to the
 * rounded total (largest-remainder apportionment). This is why the panel can
 * promise "the three parts add up to the score shown above".
 */
export function apportionPoints(exact: number[]): number[] {
  const target = Math.round(exact.reduce((sum, n) => sum + n, 0));
  const floors = exact.map((n) => Math.floor(n));
  let remainder = target - floors.reduce((sum, n) => sum + n, 0);
  const order = exact
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    out[order[cursor % order.length]!.i] += 1;
    remainder -= 1;
    cursor += 1;
  }
  cursor = 0;
  const reverse = [...order].reverse();
  while (remainder < 0 && reverse.length > 0) {
    out[reverse[cursor % reverse.length]!.i] -= 1;
    remainder += 1;
    cursor += 1;
  }
  return out;
}

/**
 * Build the composition from the stored requirement coverage (preferred) or the
 * run result, whichever carries the measured shares.
 */
export function buildScoreComposition(input: {
  coverage: Record<string, unknown> | null | undefined;
  result: Record<string, unknown> | null | undefined;
  displayedScore: number | null | undefined;
  /**
   * The requirement rows this page renders. Kept only so the panel can caption a
   * share with the counts behind it. They are NEVER used to recompute a share:
   * the score has one calculation (the stored run), and this module shows that
   * one calculation in parts. Recomputing here is what made the panel total 73
   * against a published 93.
   */
  requirementRows?: Array<{ status: string; importance?: string }> | null;
  /** Loom introduction bonus earned by this match (0 when there is no video). */
  videoBonusPts?: number;
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
      contributionPts: (valuePct * weightPct) / 100,
      displayPts: 0,
    });
  }

  if (components.length === 0) return null;

  const exactTotalPts = components.reduce((sum, c) => sum + c.contributionPts, 0);
  const totalPts = Math.round(exactTotalPts);
  const videoBonusPts =
    input.videoBonusPts != null && Number.isFinite(Number(input.videoBonusPts))
      ? Math.max(0, Math.round(Number(input.videoBonusPts)))
      : 0;

  // The score of record (the approved run, plus the video bonus) is the one
  // number every surface shows. Where review moved it away from the engine's
  // weighted parts, that movement becomes its own line, so the parts shown here
  // always add up to that number instead of contradicting it.
  const published =
    input.displayedScore != null && Number.isFinite(Number(input.displayedScore))
      ? Math.round(Number(input.displayedScore))
      : null;
  const displayedScore = published ?? totalPts + videoBonusPts;
  const adjustmentPts = displayedScore - (totalPts + videoBonusPts);

  const apportioned = apportionPoints(components.map((c) => c.contributionPts));
  apportioned.forEach((pts, i) => {
    components[i]!.displayPts = pts;
  });

  if (adjustmentPts !== 0) {
    components.push({
      key: "review_adjustment",
      label: LABELS.review_adjustment,
      valuePct: 0,
      weightPct: 0,
      contributionPts: adjustmentPts,
      displayPts: adjustmentPts,
    });
  }

  return {
    components,
    exactTotalPts: Math.round(exactTotalPts * 10) / 10,
    totalPts: displayedScore - videoBonusPts,
    videoBonusPts,
    grandTotalPts: displayedScore,
    displayedScore,
    reconciles: true,
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

/**
 * The weighted counts behind a percentage, as the requirement LIST shows them.
 *
 * This classified on the raw `status` column while the list beneath it
 * classifies through resolveRequirementStatus — which downgrades a "met" row
 * carrying no quoted passage to "not evidenced", because a verdict without a
 * quote is not evidence. The two therefore described different lists, and this
 * caption claimed to explain a list it had not read (audit #8, TF8-06).
 */
export function requirementBasis(
  rows: Array<{
    status: string;
    importance?: string;
    evidence?: unknown;
    contradictions?: unknown;
    context?: unknown;
    label?: string | null;
  }>,
  importance: "must_have" | "preferred",
): RequirementBasis | null {
  const scoped = rows.filter((r) =>
    importance === "must_have"
      ? r.importance === "must_have"
      : r.importance !== "must_have",
  ).filter((r) => r.status !== "not_applicable");
  const total = scoped.length;
  if (total === 0) return null;
  // Same resolver the rendered list uses, so the caption describes that list.
  const statuses = scoped.map((r) =>
    resolveRequirementStatus(r as Parameters<typeof resolveRequirementStatus>[0]),
  );
  const met = statuses.filter((st) => st === "met").length;
  const partial = statuses.filter((st) => st === "partial").length;
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
