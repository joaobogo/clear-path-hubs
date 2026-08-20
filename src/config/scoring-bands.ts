/**
 * Score-band *presentation*: labels, tone, accent, description.
 *
 * Thresholds are NOT defined here any more. Every boundary and the score →
 * band function come from `src/lib/scoring/bands.ts`, which is also what
 * generates the SQL `public.score_band()` function. This file only decides how
 * a band is worded and coloured.
 */

import {
  SCORE_BAND_KEYS,
  bandRange,
  classifyBand,
  type ScoreBandKey,
} from "@/lib/scoring/bands";

export const SCORE_BANDS = SCORE_BAND_KEYS;

export type ScoreBand = ScoreBandKey;

export type ScoreBandDef = {
  key: ScoreBand;
  min: number; // inclusive — derived from the canonical band table
  max: number; // inclusive — derived from the canonical band table
  label: string; // client-facing headline
  shortLabel: string; // for chips / tables
  tone: "confident" | "positive" | "neutral" | "cautious" | "dissuade" | "muted";
  accent: "emerald" | "sky" | "amber" | "slate" | "rose";
  description: string;
};

type BandCopy = Omit<ScoreBandDef, "min" | "max">;

const COPY: readonly BandCopy[] = [
  {
    key: "exceptional",
    label: "Exceptional",
    shortLabel: "Exceptional",
    tone: "confident",
    accent: "emerald",
    description: "Unicorn-level fit. Direct evidence across every dimension.",
  },
  {
    key: "top",
    label: "Top",
    shortLabel: "Top",
    tone: "confident",
    accent: "emerald",
    description: "Strongest-fit band. Prioritise for interview.",
  },
  {
    key: "strong",
    label: "Strong",
    shortLabel: "Strong",
    tone: "positive",
    accent: "sky",
    description: "Solid fit. Recommend a conversation.",
  },
  {
    key: "consider",
    label: "Consider",
    shortLabel: "Consider",
    tone: "neutral",
    accent: "amber",
    description: "Basic fit. Review before deciding.",
  },
  {
    key: "not_recommended",
    label: "Not recommended",
    shortLabel: "Not recommended",
    tone: "dissuade",
    accent: "slate",
    description: "Below the fit threshold. Not proposed to the client.",
  },
] as const;

/** Strongest to weakest, with ranges read off the canonical band table. */
export const SCORE_BAND_DEFS: readonly ScoreBandDef[] = COPY.map((c) => ({
  ...c,
  ...bandRange(c.key),
}));

export const UNSCORED_DEF: ScoreBandDef = {
  key: "unscored",
  ...bandRange("unscored"),
  label: "Not Scored",
  shortLabel: "Unscored",
  tone: "muted",
  accent: "slate",
  description: "No completed score run yet.",
};

/**
 * Classify a numeric score to a canonical band definition. Delegates the
 * numbers to `classifyBand` so there is exactly one threshold table.
 */
export function classifyScoreBand(score: number | null | undefined): ScoreBandDef {
  return bandByKey(classifyBand(score));
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
