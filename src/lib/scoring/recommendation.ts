/**
 * Recommendation derivation (Prompt 4).
 *
 * Recommendation combines Eligibility + Fit + Confidence, but never replaces
 * any of them. The three sources remain queryable and filterable on their own.
 *
 * Rules:
 *  - not_eligible                                -> do_not_recommend
 *  - needs_validation                            -> hold_for_validation
 *  - eligible + fit >= 85 + high confidence      -> shortlist
 *  - eligible + fit >= 70                        -> shortlist when confidence
 *                                                   is at least medium,
 *                                                   else review
 *  - eligible + fit >= 50                        -> review
 *  - eligible + fit < 50                         -> do_not_recommend
 *  - excepted uses the same fit thresholds as eligible.
 */

import { bandRange } from "./bands";
import { classifyConfidence } from "./status-taxonomy";
import type {
  EligibilityStatus,
  RecommendationStatus,
} from "./status-taxonomy";

/** Thresholds derived from the canonical band table — never re-typed here. */
const TOP_BAND_MIN = bandRange("top").min;
const STRONG_BAND_MIN = bandRange("strong").min;
const CONSIDER_BAND_MIN = bandRange("consider").min;

export function deriveRecommendation(input: {
  eligibility: EligibilityStatus;
  fit_score: number | null;
  evidence_confidence: number | null;
}): { status: RecommendationStatus; reason: string } {
  const { eligibility, fit_score, evidence_confidence } = input;


  if (eligibility === "not_eligible") {
    return {
      status: "do_not_recommend",
      reason: "A mandatory qualifier failed.",
    };
  }
  if (eligibility === "needs_validation") {
    return {
      status: "hold_for_validation",
      reason: "A mandatory qualifier is unknown and must be validated.",
    };
  }
  if (eligibility === "not_evaluated") {
    return {
      status: "pending",
      reason: "Eligibility has not been evaluated yet.",
    };
  }

  if (fit_score === null || fit_score === undefined) {
    return {
      status: "pending",
      reason: "No completed score run yet.",
    };
  }

  const conf = classifyConfidence(evidence_confidence);

  if (fit_score >= 85 && (conf === "high" || conf === "medium")) {
    return {
      status: "shortlist",
      reason: "Top-band fit with sufficient evidence.",
    };
  }
  if (fit_score >= 70) {
    if (conf === "high" || conf === "medium") {
      return {
        status: "shortlist",
        reason: "Strong fit with adequate evidence.",
      };
    }
    return {
      status: "review",
      reason: "Strong score, but evidence confidence is limited.",
    };
  }
  if (fit_score >= 50) {
    return {
      status: "review",
      reason: "Consider-band fit — review manually before deciding.",
    };
  }
  return {
    status: "do_not_recommend",
    reason: "Below the fit threshold.",
  };
}
