/**
 * The terminal-outcome obligation.
 * ------------------------------------------------------------------
 * We tell every applicant they hear from us either way, within five business
 * days. This module turns that promise into something measurable: for any
 * application, how long it has been waiting for an answer, and whether we have
 * actually sent one.
 *
 * Rules:
 *   1. An application is only "answered" when a terminal outcome exists AND a
 *      message was sent for it. A closed row with no notice is a broken promise,
 *      not a completed journey.
 *   2. Business days only. Nobody owes an answer over a weekend.
 *   3. No score, stage name or internal state leaks out of here — this drives an
 *      internal queue, and its language is about our obligation, not the person.
 */

import { REVIEW_WINDOW_BUSINESS_DAYS } from "./response-commitment";

/** Application statuses that are an end state for the candidate. */
export const TERMINAL_APPLICATION_STATUSES = ["withdrawn", "rejected", "archived"] as const;

/** Match stages that mean the journey has ended one way or the other. */
export const TERMINAL_MATCH_STAGES = ["not_moving_forward", "hired", "archived"] as const;

export type OutcomeState =
  | "answered" // terminal outcome and the candidate was told
  | "outcome_not_sent" // terminal outcome reached, no notice sent — worst case
  | "waiting" // still inside the promised window
  | "overdue"; // past the promised window with no outcome at all

export interface OutcomeInputs {
  applicationStatus: string;
  matchStage: string | null;
  withdrawnAt: string | null;
  closureNotifiedAt: string | null;
  /** When the clock started — applied_at, falling back to created_at. */
  appliedAt: string;
  /** Evaluation time; injected so the model stays pure and testable. */
  now?: Date;
}

/** Whole business days between two instants (weekends excluded). */
export function businessDaysBetween(from: Date, to: Date): number {
  if (!(from instanceof Date) || Number.isNaN(from.getTime())) return 0;
  if (to.getTime() <= from.getTime()) return 0;
  let days = 0;
  const cursor = new Date(from.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to.getTime());
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return days;
}

export function isTerminalApplication(i: {
  applicationStatus: string;
  matchStage: string | null;
  withdrawnAt: string | null;
}): boolean {
  if (i.withdrawnAt) return true;
  if ((TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(i.applicationStatus)) return true;
  return Boolean(i.matchStage && (TERMINAL_MATCH_STAGES as readonly string[]).includes(i.matchStage));
}

export interface OutcomeAssessment {
  state: OutcomeState;
  businessDaysWaiting: number;
  /** Business days past the commitment; 0 when still inside it. */
  daysOverdue: number;
  /** What we owe this person, in one line. Internal wording. */
  obligation: string;
  /** Ordering weight for the queue — higher is more urgent. */
  weight: number;
}

export function assessOutcome(i: OutcomeInputs): OutcomeAssessment {
  const now = i.now ?? new Date();
  const applied = new Date(i.appliedAt);
  const waiting = businessDaysBetween(applied, now);
  const overdue = Math.max(0, waiting - REVIEW_WINDOW_BUSINESS_DAYS);
  const terminal = isTerminalApplication(i);
  const told = Boolean(i.closureNotifiedAt);

  // A candidate who withdrew told us — we owe them nothing further.
  if (i.withdrawnAt) {
    return {
      state: "answered",
      businessDaysWaiting: waiting,
      daysOverdue: 0,
      obligation: "Withdrawn by the candidate — nothing owed.",
      weight: 0,
    };
  }

  if (terminal && told) {
    return {
      state: "answered",
      businessDaysWaiting: waiting,
      daysOverdue: overdue,
      obligation: "Outcome reached and sent.",
      weight: 0,
    };
  }

  if (terminal && !told) {
    return {
      state: "outcome_not_sent",
      businessDaysWaiting: waiting,
      daysOverdue: overdue,
      obligation: "Decided but never told. Send the outcome now.",
      weight: 1000 + overdue,
    };
  }

  if (overdue > 0) {
    return {
      state: "overdue",
      businessDaysWaiting: waiting,
      daysOverdue: overdue,
      obligation: `Past our ${REVIEW_WINDOW_BUSINESS_DAYS}-day review commitment with no outcome. Decide or write with a status.`,
      weight: 500 + overdue,
    };
  }

  return {
    state: "waiting",
    businessDaysWaiting: waiting,
    daysOverdue: 0,
    obligation: "Inside the review window.",
    weight: 0,
  };
}

export const OUTCOME_STATE_LABEL: Record<OutcomeState, string> = {
  answered: "Answered",
  outcome_not_sent: "Decided, not told",
  waiting: "Inside window",
  overdue: "No outcome, past window",
};

export const OUTCOME_STATE_TONE: Record<OutcomeState, string> = {
  answered: "bg-muted text-muted-foreground",
  outcome_not_sent: "taas-bg-danger-soft taas-fg-danger",
  waiting: "bg-secondary text-secondary-foreground",
  overdue: "taas-bg-warning-soft taas-fg-warning",
};

/** States that belong in the breach queue. */
export const BREACH_STATES: OutcomeState[] = ["outcome_not_sent", "overdue"];
