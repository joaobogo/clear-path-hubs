/**
 * The score and fit an MCP client is told about a released candidate — the
 * same figure and headline the client workspace shows.
 *
 * The tools used to return the run's stored fit_label ("worth_considering"),
 * written before the intro-video bonus and sometimes under older cut-offs,
 * while the workspace showed the same candidate as "Strong 73".
 */
import { toFitPresentation } from "@/lib/client-fit-presentation";
import {
  hasVideoIntro,
  publishedScore,
  publishedScoreDisplay,
  scoreVoidedByUnreadableCv,
  withVideoIntroBonus,
  type PublishedScoreRun,
} from "@/lib/scoring/published-score";

/** Match columns the tools must select for this to resolve. */
export const MCP_PUBLISHED_MATCH_COLUMNS = "intro_video_url, processing_state";
/** Run columns the tools must embed for this to resolve. */
export const MCP_PUBLISHED_RUN_COLUMNS = "score, final_score, fit_label, fit_band";

export type McpPublishedFit = {
  /** Whole-number published score (bonus folded); null when there is none. */
  score: number | null;
  /** Client-facing fit headline ("Strong"); null when nothing was assessed. */
  fitLabel: string | null;
  /** Points the intro video contributed (0 without one). */
  videoBonus: number;
};

export function mcpPublishedFit(
  match: { intro_video_url?: unknown; processing_state?: string | null } | null | undefined,
  run: PublishedScoreRun | Record<string, unknown>,
): McpPublishedFit {
  const r = (run ?? null) as PublishedScoreRun;
  if (!r || scoreVoidedByUnreadableCv(match)) return { score: null, fitLabel: null, videoBonus: 0 };
  const pub = withVideoIntroBonus(r, hasVideoIntro(match));
  const fit = toFitPresentation(r.fit_label ?? r.fit_band ?? null, publishedScore(pub));
  return {
    score: publishedScoreDisplay(pub),
    fitLabel: fit.assessed ? fit.headline : null,
    videoBonus: Number(pub?.video_bonus_awarded ?? 0),
  };
}
