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
  /**
   * Present when the caller passes a MATCH row (with its run embedded) rather
   * than a bare run. When it is, the resolver can void the score itself — see
   * publishedScore.
   */
  processing_state?: string | null;
} | null | undefined;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The scale every published score is reported on. A candidate is scored out of
 * 100 and is never shown as more than 100.
 *
 * This used to be untrue on purpose: the video bonus was added after the engine
 * had already produced a 0-100 composite, and the note here read "the total may
 * exceed 100 (97 + video = 107); bands clamp for colour only". So a strong
 * candidate with an introduction video published as 107 — a figure that reads
 * as a bug to anyone who has been told the scale is out of 100, and which no
 * band could describe. Capping is now the rule.
 *
 * The cap does not silently swallow the difference. When it bites, the score
 * composition shows it as its own line, so the breakdown still adds up to the
 * number printed beside it.
 */
export const SCORE_MAX = 100;

/** Hold a score on the scale. Null passes through — absent is not zero. */
export function clampScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(SCORE_MAX, Math.max(0, value));
}

/**
 * Points a genuine Loom introduction adds on top of the three weighted
 * components. Awarded once per match, derived at read time from
 * `candidate_matches.intro_video_url`: present link → +10, removed link → gone.
 * The result is capped at SCORE_MAX, so the bonus lifts a mid score and cannot
 * push any score past the top of the scale.
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
    // Clamped here as well as on read: callers that take `run.score` straight
    // off the returned object must not see a number off the scale either.
    return n === null ? v : clampScore(n + VIDEO_INTRO_BONUS_PTS);
  };
  return { ...run, score: shift(run.score), final_score: shift(run.final_score) } as T;
}

/**
 * The published score for a run: the human-reviewed `final_score` when the run
 * carries one, otherwise the engine `score`. Never averages or re-weights.
 */
export function publishedScore(run: PublishedScoreRun): number | null {
  if (!run) return null;
  // A score built on text that proved unreadable is not a score, and this is
  // the one place every surface passes through. Voiding here means a caller
  // that hands us a match row cannot forget: /admin/candidates showed
  // "41 · not recommended" for a candidate whose own detail page read
  // "No score — CV unreadable", because the void lived at the call sites and
  // that one had been missed (audit #8, TF8-01). Callers that pass a bare run
  // carry no processing_state and are unaffected; they must still check.
  if (scoreVoidedByUnreadableCv(run)) return null;
  // Every surface reads through here, so the ceiling holds even for a score
  // that arrived above it from somewhere this module does not control - a
  // stored final_score written by an older build, or a future adjustment.
  return clampScore(num(run.final_score) ?? num(run.score));
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
  // A score built on text that later proved unreadable is not a score, and the
  // void has to happen HERE rather than on each surface that renders one.
  // Applied per-surface, it reached the workspace header and the evidence
  // record while the candidate list, the work queue, the Score tab and the
  // client preview all went on showing "41 · Not recommended" for a CV nothing
  // could be read from (audit #6, A6-03).
  if (scoreVoidedByUnreadableCv(rest as { processing_state?: string | null })) {
    return { ...rest, score_runs: null } as T & { score_runs: Record<string, unknown> | null };
  }
  const run = (approved_run ?? current_run ?? null) as PublishedScoreRun;
  return { ...rest, score_runs: withVideoIntroBonus(run, hasVideoIntro(rest)) } as T & {
    score_runs: Record<string, unknown> | null;
  };
}

/**
 * A score built on text that later proved unreadable is not a score. When a
 * candidate sits in ocr_required, every surface must show "no score" instead
 * of the number the garbage text produced — the audit found a byte-soup CV
 * wearing "41 · Not recommended" while its state said unreadable (H1).
 */
export function scoreVoidedByUnreadableCv(
  match: { processing_state?: string | null } | null | undefined,
): boolean {
  return String(match?.processing_state ?? "") === "ocr_required";
}

/**
 * Pick the published run out of a full run history: the approved run wins,
 * then the current pointer, then the newest run. This is the run-array twin of
 * `withPublishedRun` for surfaces that load every run (candidate workspace,
 * evidence record) instead of embedding one. Headlines must come from this
 * run — `runs[0]` is the latest ENGINE OPINION, which after a rescore can be
 * a number no human has approved and no client has seen.
 */
export function resolvePublishedRun<T extends { id?: unknown }>(
  runs: readonly T[] | null | undefined,
  match:
    | { approved_score_run_id?: string | null; current_score_run_id?: string | null }
    | null
    | undefined,
): T | null {
  const list = runs ?? [];
  for (const wanted of [match?.approved_score_run_id, match?.current_score_run_id]) {
    if (!wanted) continue;
    const hit = list.find((r) => String(r.id) === String(wanted));
    if (hit) return hit;
  }
  return list[0] ?? null;
}

