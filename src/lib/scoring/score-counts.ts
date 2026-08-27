/**
 * THE counts built from scores.
 *
 * The score itself is resolved in one place (`./published-score`) and the band
 * thresholds live in one place (`./bands`). This module owns the third thing
 * that used to be duplicated: the *predicates and counts* derived from a band.
 *
 * "Strongest candidates" alone had four implementations — the client KPI
 * selector, the client list filter, the candidate tile helper and the candidate
 * server filter — each spelling the same three band keys out by hand. When one
 * copy was edited the admin figure and the client figure disagreed for the same
 * rows. Admin and client surfaces now both read the functions here.
 */
import { classifyBand, UNICORN_SCORE, type ScoreBandKey } from "./bands";
import { publishedScore, type PublishedScoreRun } from "./published-score";

/** Bands that count as "strong enough to act on": the strongest three. */
export const STRONG_FIT_BANDS: readonly ScoreBandKey[] = [
  "exceptional",
  "top",
  "strong",
];

/** The one band predicate behind every "strongest candidates" figure. */
export function isStrongFitBand(band: string | null | undefined): boolean {
  return (STRONG_FIT_BANDS as readonly string[]).includes(String(band ?? ""));
}

/** The same predicate starting from a number rather than a band. */
export function isStrongFitScore(score: number | null | undefined): boolean {
  if (score === null || score === undefined) return false;
  return isStrongFitBand(classifyBand(score));
}

/** The same predicate starting from a score run. */
export function isStrongFitRun(run: PublishedScoreRun): boolean {
  return isStrongFitScore(publishedScore(run));
}

/** A standout by number alone; the full rule lives in `isUnicornMatch`. */
export function isUnicornScore(score: number | null | undefined): boolean {
  return score !== null && score !== undefined && Number(score) >= UNICORN_SCORE;
}

/** Count of strong-fit rows, given how to read each row's band. */
export function countStrongFit<T>(
  rows: readonly T[],
  bandOf: (row: T) => string | null | undefined,
): number {
  return rows.reduce((n, row) => (isStrongFitBand(bandOf(row)) ? n + 1 : n), 0);
}

/**
 * Band buckets for a set of scores — one bucketing rule for delivery reports,
 * role stories and any other band histogram. Buckets are the canonical band
 * keys, so no surface invents its own 80/60 cut-offs.
 */
export function countByBand(
  scores: readonly (number | null | undefined)[],
): Record<ScoreBandKey, number> {
  const out: Record<ScoreBandKey, number> = {
    exceptional: 0,
    top: 0,
    strong: 0,
    consider: 0,
    not_recommended: 0,
    unscored: 0,
  };
  for (const score of scores) {
    if (score === null || score === undefined) {
      out.unscored += 1;
      continue;
    }
    out[classifyBand(score)] += 1;
  }
  return out;
}
