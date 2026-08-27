/**
 * THE published score of a candidate match.
 *
 * Before this module each surface resolved the number its own way: the admin
 * candidate index read `final_score ?? score`, the client DTO read `score`
 * only, and a few panels re-derived a band from a stored label. A human
 * adjustment (which writes `final_score` and leaves `raw`/`score` alone) then
 * showed one figure to the recruiter and another to the employer for the same
 * approved run.
 *
 * Every surface — admin list, client list, candidate detail, exports — must
 * resolve score and band through the functions here. Thresholds still come
 * from `./bands`; this module only decides WHICH number is the published one.
 */
import { classifyBand, type ScoreBandKey } from "./bands";

/** Columns a score-run select needs for the published number to be resolvable. */
export const PUBLISHED_SCORE_COLUMNS = "score, final_score, fit_label, fit_band";

export type PublishedScoreRun = {
  score?: number | string | null;
  final_score?: number | string | null;
  fit_label?: string | null;
  fit_band?: string | null;
} | null | undefined;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Points a genuine Loom introduction adds on top of the three weighted
 * components. Awarded once per match, derived at read time from
 * `candidate_matches.intro_video_url`: present link → +10, removed link → gone.
 * The total may exceed 100 (97 + video = 107); bands clamp for colour only.
 */
export const VIDEO_INTRO_BONUS_PTS = 10;

/** True when the match carries a stored intro video link (validated at write). */
export function hasVideoIntro(
  row: { intro_video_url?: unknown } | null | undefined,
): boolean {
  return typeof row?.intro_video_url === "string" && row.intro_video_url.trim().length > 0;
}

/**
 * A copy of the run with the video bonus folded into both score columns.
 * `final_score ?? score` then resolves to the post-bonus figure on every
 * surface, so admin and client can never print the pre-bonus number beside it.
 */
export function withVideoIntroBonus<T extends PublishedScoreRun>(run: T, hasVideo: boolean): T {
  if (!run || !hasVideo) return run as T;
  const shift = (v: unknown) => {
    const n = num(v);
    return n === null ? v : n + VIDEO_INTRO_BONUS_PTS;
  };
  return { ...run, score: shift(run.score), final_score: shift(run.final_score) } as T;
}

/**
 * The published score for a run: the human-reviewed `final_score` when the run
 * carries one, otherwise the engine `score`. Never averages or re-weights.
 */
export function publishedScore(run: PublishedScoreRun): number | null {
  if (!run) return null;
  return num(run.final_score) ?? num(run.score);
}

/** Whole-number figure for display. Same rounding on every surface. */
export function publishedScoreDisplay(run: PublishedScoreRun): number | null {
  const value = publishedScore(run);
  return value === null ? null : Math.round(value);
}

/** Canonical band for a run: the published number decides. */
export function publishedBand(run: PublishedScoreRun): ScoreBandKey | null {
  const value = publishedScore(run);
  return value === null ? null : classifyBand(value);
}

/**
 * Embed for a candidate_matches select that must resolve the published run.
 *
 * Admin surfaces used to embed the CURRENT run only, while the client DTO
 * embeds the APPROVED run: a match whose current run was superseded (a legacy
 * fill, a recompute) then showed one number to the recruiter and another to the
 * employer. Embedding both and preferring the approved one makes the two sides
 * read the same run by construction.
 */
export function publishedRunEmbed(extraColumns = ""): string {
  const cols = extraColumns
    ? `${PUBLISHED_SCORE_COLUMNS}, ${extraColumns}`
    : PUBLISHED_SCORE_COLUMNS;
  return (
    `approved_run:score_runs!candidate_matches_approved_score_run_id_fkey(${cols}),` +
    `current_run:score_runs!candidate_matches_current_score_run_id_fkey(${cols})`
  );
}

/** Collapses the two embedded runs into `score_runs` — approved wins, video bonus folded. */
export function withPublishedRun<T extends Record<string, unknown>>(row: T) {
  const { approved_run, current_run, ...rest } = row as Record<string, unknown>;
  const run = (approved_run ?? current_run ?? null) as PublishedScoreRun;
  return { ...rest, score_runs: withVideoIntroBonus(run, hasVideoIntro(rest)) } as T & {
    score_runs: Record<string, unknown> | null;
  };
}

