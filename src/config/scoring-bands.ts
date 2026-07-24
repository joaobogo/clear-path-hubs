/**
 * Canonical score-band configuration.
 *
 * SINGLE SOURCE OF TRUTH for numeric-score -> band mapping across the entire
 * product. A score of 87 must be "Top Fit" everywhere — on the admin desk,
 * client kanban, share links, exports, PDFs, and analytics.
 *
 * Mirrors public.score_band enum and public.score_band(numeric) SQL function.
 * If you change thresholds here, migrate the SQL function in lockstep.
 */

export const SCORE_BANDS = [
  "exceptional",
  "top",
  "strong",
  "consider",
  "not_recommended",
  "unscored",
] as const;

export type ScoreBand = (typeof SCORE_BANDS)[number];

export type ScoreBandDef = {
  key: ScoreBand;
  min: number; // inclusive
  max: number; // inclusive
  label: string; // client-facing headline
  shortLabel: string; // for chips / tables
  tone: "confident" | "positive" | "neutral" | "cautious" | "dissuade" | "muted";
  accent: "emerald" | "sky" | "amber" | "slate" | "rose";
  description: string;
};

/**
 * Thresholds mirror the public website methodology.
 * Ordered from strongest to weakest — order matters for classify().
 */
export const SCORE_BAND_DEFS: readonly ScoreBandDef[] = [
  {
    key: "exceptional",
    min: 95,
    max: 100,
    label: "Exceptional Fit",
    shortLabel: "Exceptional",
    tone: "confident",
    accent: "emerald",
    description: "Unicorn-level fit. Direct evidence across every dimension.",
  },
  {
    key: "top",
    min: 85,
    max: 94,
    label: "Top Fit",
    shortLabel: "Top",
    tone: "confident",
    accent: "emerald",
    description: "Strongest-fit band. Prioritise for interview.",
  },
  {
    key: "strong",
    min: 70,
    max: 84,
    label: "Strong Fit",
    shortLabel: "Strong",
    tone: "positive",
    accent: "sky",
    description: "Solid fit. Recommend a conversation.",
  },
  {
    key: "consider",
    min: 50,
    max: 69,
    label: "Consider",
    shortLabel: "Consider",
    tone: "neutral",
    accent: "amber",
    description: "Basic fit. Review before deciding.",
  },
  {
    key: "not_recommended",
    min: 0,
    max: 49,
    label: "Not Recommended",
    shortLabel: "Not Recommended",
    tone: "dissuade",
    accent: "slate",
    description: "Below the fit threshold. Not proposed to the client.",
  },
] as const;

export const UNSCORED_DEF: ScoreBandDef = {
  key: "unscored",
  min: 0,
  max: 0,
  label: "Not Scored",
  shortLabel: "Unscored",
  tone: "muted",
  accent: "slate",
  description: "No completed score run yet.",
};

/**
 * Classify a numeric score to a canonical band definition.
 * Null/undefined/NaN -> unscored. Values are clamped to 0..100.
 */
export function classifyScoreBand(
  score: number | null | undefined,
): ScoreBandDef {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return UNSCORED_DEF;
  }
  const clamped = Math.max(0, Math.min(100, score));
  for (const def of SCORE_BAND_DEFS) {
    if (clamped >= def.min && clamped <= def.max) return def;
  }
  return UNSCORED_DEF;
}

/**
 * Whole-number score for client-facing display. Internal math keeps
 * decimal precision; UI never fabricates precision like "87.4".
 */
export function displayScore(score: number | null | undefined): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null;
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Lookup by band key. Cheap map for O(1) reads in hot loops.
 */
const BAND_MAP: Readonly<Record<ScoreBand, ScoreBandDef>> = Object.fromEntries([
  ...SCORE_BAND_DEFS.map((d) => [d.key, d] as const),
  [UNSCORED_DEF.key, UNSCORED_DEF] as const,
]) as Record<ScoreBand, ScoreBandDef>;

export function bandByKey(key: ScoreBand): ScoreBandDef {
  return BAND_MAP[key] ?? UNSCORED_DEF;
}
