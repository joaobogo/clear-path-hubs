/**
 * THE band table. One boundary set for the whole product.
 *
 * Before this module the same score could land in three different bands: the
 * engine's `fit_label` had its own cut-offs, `client-fit-presentation.ts` had a
 * second set for its numeric fallback, the score visuals had a third, and the
 * SQL `public.score_band()` function had a fourth. Everything now derives from
 * `SCORE_BAND_BOUNDARIES` below.
 *
 * Band *keys* are the values of the Postgres `public.score_band` enum, so this
 * module is also the generator for the SQL function — see `buildScoreBandSql()`
 * and `src/lib/scoring/score-band.sql`. The parity test in
 * `src/lib/scoring/__tests__/bands-sql-parity.test.ts` fails if the checked-in
 * SQL drifts from these numbers.
 *
 * Client-facing wording lives elsewhere (`src/config/scoring-bands.ts`,
 * `client-fit-presentation.ts`). This module owns thresholds, not copy.
 */

export const SCORE_BAND_KEYS = [
  "exceptional",
  "top",
  "strong",
  "consider",
  "not_recommended",
  "unscored",
] as const;

export type ScoreBandKey = (typeof SCORE_BAND_KEYS)[number];

/** Scored bands, strongest first. `min` is inclusive; the last one is the floor. */
export const SCORE_BAND_BOUNDARIES: readonly { key: Exclude<ScoreBandKey, "unscored">; min: number }[] =
  [
    { key: "exceptional", min: 95 },
    { key: "top", min: 85 },
    { key: "strong", min: 70 },
    { key: "consider", min: 50 },
    { key: "not_recommended", min: 0 },
  ] as const;

export const UNSCORED_BAND: ScoreBandKey = "unscored";

/** Inclusive numeric range of a band, derived from the boundary list. */
export function bandRange(key: ScoreBandKey): { min: number; max: number } {
  if (key === "unscored") return { min: 0, max: 0 };
  const i = SCORE_BAND_BOUNDARIES.findIndex((b) => b.key === key);
  const min = SCORE_BAND_BOUNDARIES[i]!.min;
  const max = i === 0 ? 100 : SCORE_BAND_BOUNDARIES[i - 1]!.min - 1;
  return { min, max };
}

/**
 * The single score → band function. Null/NaN is `unscored`, never a made-up
 * band. Values outside 0–100 are clamped.
 */
export function classifyBand(score: number | null | undefined): ScoreBandKey {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) {
    return UNSCORED_BAND;
  }
  const clamped = Math.max(0, Math.min(100, Number(score)));
  for (const b of SCORE_BAND_BOUNDARIES) {
    if (clamped >= b.min) return b.key;
  }
  return UNSCORED_BAND;
}

// ── Derived vocabularies ─────────────────────────────────────────────────────
// Other layers keep their own words; they must not keep their own numbers.

/** Engine `fit_label` vocabulary, derived from the canonical band. */
export function bandToFitLabel(
  band: ScoreBandKey,
): "strong_fit" | "worth_considering" | "not_a_fit" | "unknown" {
  switch (band) {
    case "exceptional":
    case "top":
    case "strong":
      return "strong_fit";
    case "consider":
      return "worth_considering";
    case "not_recommended":
      return "not_a_fit";
    default:
      return "unknown";
  }
}

/** Five-tier visual/tone vocabulary used by score visuals and status chips. */
export function bandToTier(
  band: ScoreBandKey,
): "excellent" | "strong" | "moderate" | "weak" | "poor" | null {
  switch (band) {
    case "exceptional":
    case "top":
      return "excellent";
    case "strong":
      return "strong";
    case "consider":
      return "moderate";
    case "not_recommended":
      return "poor";
    default:
      return null;
  }
}

/** The strongest tier — used for standout markers, never a literal number. */
export const TOP_TIER_BANDS: readonly ScoreBandKey[] = ["exceptional", "top"];

export function isTopBand(band: ScoreBandKey): boolean {
  return TOP_TIER_BANDS.includes(band);
}

/** A score at or above this is a unicorn candidate, full stop. */
export const UNICORN_SCORE = 95;

/**
 * The unicorn rule, in one place.
 *
 * Two ways to earn it: a fit score of 95 or higher (the top of the scale), or a
 * confirmed hire out of the canonical top tier — outcome-verified fit.
 */
export function isUnicornMatch(input: {
  score?: number | null;
  band?: ScoreBandKey | null;
  /** True only for a confirmed hire (stage `hired`). */
  hired: boolean;
}): boolean {
  const score = input.score ?? null;
  if (score != null && score >= UNICORN_SCORE) return true;
  const band = input.band ?? classifyBand(score);
  return input.hired && isTopBand(band);
}



// ── SQL generation ───────────────────────────────────────────────────────────

/**
 * Generates `public.score_band(numeric)` from the boundary table so the
 * database cannot hold a second opinion about where a band starts.
 */
export function buildScoreBandSql(): string {
  const branches = SCORE_BAND_BOUNDARIES.filter((b) => b.min > 0)
    .map((b) => `    WHEN _score >= ${b.min} THEN '${b.key}'::public.score_band`)
    .join("\n");
  const floor = SCORE_BAND_BOUNDARIES[SCORE_BAND_BOUNDARIES.length - 1]!.key;
  return [
    "-- GENERATED from src/lib/scoring/bands.ts (buildScoreBandSql). Do not hand-edit.",
    "CREATE OR REPLACE FUNCTION public.score_band(_score numeric)",
    "RETURNS public.score_band",
    "LANGUAGE sql",
    "IMMUTABLE",
    "SET search_path = public, extensions",
    "AS $$",
    "  SELECT CASE",
    "    WHEN _score IS NULL THEN 'unscored'::public.score_band",
    branches,
    `    ELSE '${floor}'::public.score_band`,
    "  END",
    "$$;",
    "",
  ].join("\n");
}
