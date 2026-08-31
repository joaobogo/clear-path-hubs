/**
 * The published score AS A REVIEW QUEUE MUST SHOW IT — one derivation.
 *
 * There are two readers behind /admin/scoring/review: the main queue
 * (scoring-review.functions.ts) and the triage lists that render "Blocking a
 * client deliverable" (scoring-review-triage.server.ts). The main one applied
 * the intro-video bonus, recomputed the band from the adjusted total, and
 * voided a score whose CV proved unreadable. The triage one did none of those.
 *
 * So the same candidate read "Consider · 67" on the queue a reviewer works
 * from and "77 · Strong" on the candidate record and the list a recruiter
 * works from — a difference that crosses a band boundary, which means the two
 * people reach different decisions about the same person (audit #8, TF8-02).
 *
 * This is the third time this exact symptom has been filed: it was fixed once
 * in the main reader (audit #6, A6-02) and the second reader never got it.
 * Both call this now.
 */
import { classifyBand, type ScoreBandKey } from "./bands";
import {
  VIDEO_INTRO_BONUS_PTS,
  hasVideoIntro,
  scoreVoidedByUnreadableCv,
} from "./published-score";

export type ReviewRowScore = {
  /** The number to show, after bonuses. Null when there is no usable score. */
  final_score: number | null;
  /** The band of that number — never a band stored against a pre-bonus score. */
  score_band: ScoreBandKey | null;
};

/** The match facts that change what a review row may display. */
export type ReviewScoreMatch =
  | {
      intro_video_url?: string | null;
      processing_state?: string | null;
    }
  | null
  | undefined;

/**
 * @param base   the run's stored figure (final_score ?? score)
 * @param match  the candidate match, for the video bonus and the CV state
 */
export function reviewRowScore(
  base: number | null | undefined,
  match: ReviewScoreMatch,
): ReviewRowScore {
  // A score built on text that proved unreadable is not a score, on this
  // surface either.
  if (scoreVoidedByUnreadableCv(match)) return { final_score: null, score_band: null };

  // Explicitly, before Number(): Number(null) is 0, which is finite, so an
  // absent score would otherwise become 0 — and then 0 + the video bonus.
  if (base === null || base === undefined) return { final_score: null, score_band: null };
  const value = Number(base);
  if (!Number.isFinite(value)) return { final_score: null, score_band: null };

  const total = hasVideoIntro(match) ? value + VIDEO_INTRO_BONUS_PTS : value;

  // Banded from the total, always. A band stored against the pre-bonus figure
  // is how "Consider" survived beside a 77.
  return { final_score: total, score_band: classifyBand(total) };
}
