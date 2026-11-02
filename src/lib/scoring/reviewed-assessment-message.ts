/**
 * The confirmation a reviewer sees after recording requirement verdicts.
 *
 * The new run holds the evidence figure only (runs never carry the intro-video
 * bonus), so printing it alone told the reviewer "67.5/100" and the page then
 * refreshed to the published 73. With a video attached the toast now shows the
 * sum that produces the published figure.
 */
import { evidenceWithVideoLabel } from "./published-score";

export type ReviewedAssessmentOutcome = {
  /** The evidence figure the new run carries. */
  final_score: number;
  /** Points the intro video adds on top of it (0 without a video). */
  video_bonus?: number | null;
};

export function reviewedAssessmentMessage(outcome: ReviewedAssessmentOutcome): string {
  const bonus = Number(outcome.video_bonus ?? 0);
  if (bonus > 0) {
    return `Recorded — new reviewed assessment: evidence ${evidenceWithVideoLabel(outcome.final_score, true)}/100`;
  }
  return `Recorded — new reviewed assessment at ${Number(outcome.final_score).toFixed(1)}/100`;
}
