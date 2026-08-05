/**
 * Interviewer assignments — a single candidate, granted to a single
 * interviewer, for one interview stage, that ends by itself.
 *
 * Interviewers do NOT get pipeline access. An assignment is the only thing
 * that makes one candidate readable to them, and it ends the moment their
 * feedback is submitted or the candidate is declined. There are no permanent
 * grants and no contact details unless contact has been released separately.
 *
 * This module holds the rules the UI and the server both read, so what the
 * page says about an assignment is what the database enforces.
 */

/** Stages a candidate can no longer be assigned in. */
export const CLOSED_STAGES = ["not_moving_forward", "archived", "hired"] as const;

export type AssignmentEndReason = "feedback_submitted" | "candidate_declined" | "revoked";

export type InterviewerAssignment = {
  id: string;
  interviewerUserId: string;
  interviewerName: string;
  interviewerEmail: string | null;
  grantedByName: string;
  grantedAt: string;
  stageLabel: string | null;
  endedAt: string | null;
  endedReason: AssignmentEndReason | null;
};

export type EligibleInterviewer = {
  userId: string;
  name: string;
  email: string | null;
  /** Already holds an active assignment to this candidate. */
  assigned: boolean;
};

/** Why an assignment cannot be created right now, or null when it can. */
export function assignmentBlockedReason(input: {
  stage: string;
  interviewerStatus?: string | null;
  alreadyAssigned?: boolean;
}): string | null {
  if (input.stage === "not_moving_forward") {
    return "This candidate has been declined, so there is nothing left to interview for.";
  }
  if (input.stage === "archived") {
    return "This candidate is archived. Reopen the role before assigning an interviewer.";
  }
  if (input.stage === "hired") {
    return "This candidate has been hired, so interview access is no longer granted.";
  }
  if (input.interviewerStatus && input.interviewerStatus !== "active") {
    return "Only active team members can be assigned. Reactivate them on your team page first.";
  }
  if (input.alreadyAssigned) {
    return "They already have access to this candidate.";
  }
  return null;
}

/** Plain sentence describing what an assignment currently allows. */
export function assignmentStatusLine(a: InterviewerAssignment): string {
  if (!a.endedAt) {
    return "Can open this candidate only. Access ends when their feedback is submitted.";
  }
  switch (a.endedReason) {
    case "feedback_submitted":
      return "Access ended — feedback submitted.";
    case "candidate_declined":
      return "Access ended — candidate declined.";
    case "revoked":
      return "Access ended — removed by your team.";
    default:
      return "Access ended.";
  }
}

/** Human label for the stage an assignment was granted for. */
export function stageLabelFor(stage: string): string {
  return String(stage).replace(/_/g, " ");
}
