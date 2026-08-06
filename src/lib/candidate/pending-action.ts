/**
 * The candidate's next required action, derived only from items that really
 * exist in the data.
 *
 * Rules:
 *   1. An action is only returned when there is a concrete pending item — an
 *      unanswered question, an interview waiting on the candidate's times, or
 *      a CV we could not read. Never invented, never inferred from a stage.
 *   2. No estimated decision dates and no countdowns to events that may not
 *      happen. A deadline is only shown when the item itself carries one.
 *   3. When nothing is pending the caller says so explicitly; silence is what
 *      makes candidates email support.
 */

import { candidateParseMessage } from "@/lib/parse-failure/parse-failure-codes";

export const NOTHING_NEEDED_LINE = "Nothing needed from you right now.";

export type CandidatePendingActionKind = "info_request" | "interview_times" | "document";

export interface CandidatePendingAction {
  kind: CandidatePendingActionKind;
  /** One line: what the candidate must do. */
  title: string;
  /** One line: why, in plain words. */
  detail: string;
  /** Button label. */
  actionLabel: string;
  /** In-page anchor for the section that holds the action. */
  target: string;
  /** ISO date the item is due, only when the item carries one. */
  dueAt: string | null;
  /** The due date has already passed. */
  overdue: boolean;
}

export interface PendingActionInputs {
  infoRequests: Array<{
    status: string;
    due_at: string | null;
  }>;
  interviews: Array<{
    status: string;
    scheduled_at: string | null;
    cancelled_at?: string | null;
  }>;
  document: { received: boolean; parseState?: string | null; errorCode?: string | null } | null;
  /** Closed applications never ask anything of the candidate. */
  closed: boolean;
}

export function computePendingAction(input: PendingActionInputs): CandidatePendingAction | null {
  if (input.closed) return null;

  const openRequests = input.infoRequests
    .filter((r) => r.status === "open")
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));
  const request = openRequests[0];
  if (request) {
    const dueAt = request.due_at ?? null;
    const overdue = !!dueAt && new Date(dueAt).getTime() < Date.now();
    return {
      kind: "info_request",
      title:
        openRequests.length > 1
          ? `Answer ${openRequests.length} questions from the team`
          : "Answer a question from the team",
      detail: overdue
        ? "This request has passed its reply date. Send us a message and we will pick it up."
        : "The review cannot move on until we have your reply.",
      actionLabel: overdue ? "Send a message" : "Reply now",
      target: overdue ? "/me/messages" : "#info-requests",
      dueAt,
      overdue,
    };
  }

  const awaitingTimes = input.interviews.find(
    (i) =>
      !i.cancelled_at &&
      !i.scheduled_at &&
      (i.status === "requested" || i.status === "scheduling"),
  );
  if (awaitingTimes) {
    return {
      kind: "interview_times",
      title: "Give the times that work for your interview",
      detail: "The employer asked for an interview and is waiting on your availability.",
      actionLabel: "Share your availability",
      target: "#interviews",
      dueAt: null,
      overdue: false,
    };
  }

  if (input.document && !input.document.received) {
    // The reason is written out in plain words, taken from the recorded failure
    // cause. Internal codes never reach the candidate.
    const written = candidateParseMessage(
      input.document.parseState ?? "failed",
      input.document.errorCode ?? null,
    );
    return {
      kind: "document",
      title: "Upload your CV again",
      detail:
        written ??
        "We could not read the file you sent, so a reviewer cannot see your experience.",
      actionLabel: "Replace your CV",
      target: "/me/cv",
      dueAt: null,
      overdue: false,
    };
  }

  return null;
}

/** Deadline sentence for an action, or null when the item has no due date. */
export function pendingActionDeadline(action: CandidatePendingAction): string | null {
  if (!action.dueAt) return null;
  const when = new Date(action.dueAt).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return action.overdue ? `Was due ${when}` : `By ${when}`;
}
