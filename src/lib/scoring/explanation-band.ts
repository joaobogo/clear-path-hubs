/**
 * The engine stores a one-line explanation whose first clause names the fit.
 * Historically that clause used the engine's own `fit_label` vocabulary
 * ("worth considering", "strong fit", "not a fit") while every *surface* bands
 * the number through the canonical table. The two disagree at the boundaries,
 * so a candidate could show a "Strong" header above a sentence reading
 * "worth considering — score 82.9/100" (audit #4, M3).
 *
 * `buildExplanation` now writes the canonical band label, but runs scored
 * before that change still carry the old wording. This rewrites the leading
 * clause at render time from the run's own number, so old and new runs read
 * the same and no surface has to trust a stale string.
 */

import { classifyScoreBand } from "@/config/scoring-bands";

/** Matches the leading `<anything> — score <n>/100` clause the engine writes. */
const LEADING_CLAUSE = /^\s*([^·]*?)\s*—\s*score\s+(\d+(?:\.\d+)?)\s*\/\s*100/i;

/**
 * Rewrite the band word in a stored explanation so it agrees with the band
 * the score actually falls in. Returns the input unchanged when the sentence
 * does not start with the engine's clause (nothing to reconcile).
 */
export function reconcileExplanationBand(explanation: string | null | undefined): string {
  const text = String(explanation ?? "");
  const m = LEADING_CLAUSE.exec(text);
  if (!m) return text;

  const score = Number(m[2]);
  if (!Number.isFinite(score)) return text;

  const canonical = classifyScoreBand(score).label;
  // The header shows a whole number, so this sentence must too — stored runs
  // carry "score 82.9/100" under a header reading "83" (audit #6, A6-25).
  const whole = String(Math.round(score));
  const agrees = m[1]!.trim().toLowerCase() === canonical.toLowerCase();
  // Already agrees on both counts — leave the exact stored bytes alone.
  if (agrees && m[2] === whole) return text;

  return text.replace(LEADING_CLAUSE, `${canonical} — score ${whole}/100`);
}
