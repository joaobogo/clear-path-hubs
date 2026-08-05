/**
 * What a candidate is told when an application closes.
 *
 * Rules:
 *   1. The reason is read from a recorded outcome only — the role's recorded
 *      closure reason, the recorded "not moving forward" decision, or the
 *      candidate's own withdrawal. Nothing is inferred from stage, score,
 *      evidence or anything about the person.
 *   2. When no outcome was recorded, one sentence and no more:
 *      "The employer has decided not to move forward."
 *   3. Five factual reasons exist. No feedback, no ranking, no "not a fit".
 */

export const CLOSED_REASON_KEYS = [
  "position_filled",
  "requirements_changed",
  "position_withdrawn",
  "moved_forward_with_others",
  "withdrawn_by_you",
] as const;

export type ClosedReasonKey = (typeof CLOSED_REASON_KEYS)[number];

/** The only sentences a candidate reads for a closed application. */
export const CLOSED_REASON_LINE: Record<ClosedReasonKey, string> = {
  position_filled: "The position was filled.",
  requirements_changed: "The requirements for the position changed.",
  position_withdrawn: "The position was withdrawn by the employer.",
  moved_forward_with_others: "The employer moved forward with other candidates.",
  withdrawn_by_you: "You withdrew this application.",
};

/** Used when nothing was recorded. Says this and nothing more. */
export const CLOSED_REASON_UNRECORDED = "The employer has decided not to move forward.";

export interface ClosedOutcomeInputs {
  /** applications.withdrawn_at */
  withdrawnAt?: string | null;
  /** positions.closure_reason — recorded on the role, may be null. */
  positionClosureReason?: string | null;
  /** positions.closed_at */
  positionClosedAt?: string | null;
  /** True when a "not moving forward" decision is recorded for this candidate. */
  notMovingForward?: boolean;
  /** When that decision was recorded, if known. */
  notMovingForwardAt?: string | null;
}

export interface ClosedOutcome {
  /** Null when no outcome was recorded — the caller shows the single sentence. */
  reason: ClosedReasonKey | null;
  /** The sentence to render. Never blank, never an internal code. */
  line: string;
  /** ISO date the role closed for this candidate, or null when not recorded. */
  closedAt: string | null;
}

/** Recorded role-closure reasons → candidate-facing reasons. */
const POSITION_REASON_MAP: Record<string, ClosedReasonKey> = {
  hired_through_taasflow: "position_filled",
  hired_elsewhere: "position_filled",
  cancelled: "position_withdrawn",
  budget_withdrawn: "position_withdrawn",
  requirements_changed: "requirements_changed",
};

export function buildClosedOutcome(i: ClosedOutcomeInputs): ClosedOutcome {
  // The candidate's own action outranks everything else: telling them the
  // employer decided would be untrue.
  if (i.withdrawnAt) {
    return {
      reason: "withdrawn_by_you",
      line: CLOSED_REASON_LINE.withdrawn_by_you,
      closedAt: i.withdrawnAt,
    };
  }

  const roleReason = i.positionClosureReason
    ? POSITION_REASON_MAP[i.positionClosureReason]
    : undefined;
  if (roleReason) {
    return {
      reason: roleReason,
      line: CLOSED_REASON_LINE[roleReason],
      closedAt: i.positionClosedAt ?? i.notMovingForwardAt ?? null,
    };
  }

  if (i.notMovingForward) {
    return {
      reason: "moved_forward_with_others",
      line: CLOSED_REASON_LINE.moved_forward_with_others,
      closedAt: i.notMovingForwardAt ?? i.positionClosedAt ?? null,
    };
  }

  return {
    reason: null,
    line: CLOSED_REASON_UNRECORDED,
    closedAt: i.positionClosedAt ?? null,
  };
}
