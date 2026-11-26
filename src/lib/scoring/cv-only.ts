/**
 * A score with no screening answers behind it.
 *
 * When a role asks screening questions and a candidate has answered none, the
 * screening part of the score drops out and the rest is re-weighted. The
 * number is right for what it measures, but it measures less: 62.5 from the CV
 * alone is not the same claim as 60 from the CV and the candidate's answers.
 * The maths stays as it is; every list and card that shows such a score says
 * so beside it, so the two are never read as like for like.
 *
 * A role that asks no screening questions has nothing unanswered, so its
 * scores carry no label.
 */

export const CV_ONLY_LABEL = "CV only, screening not answered";
export const CV_ONLY_SHORT = "CV only";
export const CV_ONLY_EXPLANATION =
  "This candidate has not answered the role's screening questions, so the score is built from the CV alone. Compare it with care against candidates who have answered.";

export function isCvOnlyScore(i: {
  /** The match has a score to qualify. */
  scored: boolean;
  /** The role asks at least one screening question. */
  roleHasQuestions: boolean;
  /** At least one answer is on file, the candidate's own or recruiter-entered. */
  hasAnswers: boolean;
}): boolean {
  return i.scored && i.roleHasQuestions && !i.hasAnswers;
}
