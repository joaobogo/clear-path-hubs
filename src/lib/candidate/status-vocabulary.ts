/**
 * The candidate status vocabulary — the single place internal lifecycle values
 * are turned into words a candidate reads.
 *
 * Rules:
 *   1. Six states, no more. Internal stage names, processing states, scores,
 *      percentages and "being analysed" language never reach a candidate.
 *   2. Every surface — the applications list, the application detail page, the
 *      public reference lookup, and email — imports from here. No screen
 *      derives its own label, so one application reads identically everywhere.
 *   3. Status is always words. Tone classes are decoration only; the label
 *      carries the meaning.
 */

export const CANDIDATE_STATUSES = [
  "Received",
  "Under review",
  "Shared with the employer",
  "Interviewing",
  "Offer stage",
  "Closed",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export interface CandidateStatusCopy {
  status: CandidateStatus;
  /** One line: what this status means. */
  meaning: string;
  /** One line: what the candidate should do now — never blank. */
  nextStep: string;
  /** Design-token chip tone. Never colour alone; the label is the signal. */
  tone: string;
}

export const CANDIDATE_STATUS_COPY: Record<CandidateStatus, CandidateStatusCopy> = {
  Received: {
    status: "Received",
    meaning: "Your application and CV are with us.",
    nextStep: "Nothing needed from you. We email you when there is news.",
    tone: "bg-secondary text-secondary-foreground",
  },
  "Under review": {
    status: "Under review",
    meaning: "A reviewer is reading your application against the role.",
    nextStep: "Nothing needed from you. You can still upload a newer CV.",
    tone: "taas-bg-info-soft taas-fg-info",
  },
  "Shared with the employer": {
    status: "Shared with the employer",
    meaning: "Your profile has been passed to the employer for this role.",
    nextStep: "Nothing needed from you. The employer decides the next step.",
    tone: "taas-bg-info-soft taas-fg-info",
  },
  Interviewing: {
    status: "Interviewing",
    meaning: "The employer is arranging or holding interviews with you.",
    nextStep: "Watch for interview details, and tell us if a time does not work.",
    tone: "taas-bg-success-soft taas-fg-success",
  },
  "Offer stage": {
    status: "Offer stage",
    meaning: "The employer is discussing an offer with you.",
    nextStep: "Reply to the offer conversation in your inbox.",
    tone: "taas-bg-success-soft taas-fg-success",
  },
  Closed: {
    status: "Closed",
    meaning: "This application is no longer active.",
    nextStep: "Nothing further for this role. You are welcome to apply to others.",
    tone: "bg-muted text-muted-foreground",
  },
};

export interface CandidateLifecycleInputs {
  /** applications.status */
  applicationStatus: string;
  /** positions.status */
  positionStatus?: string | null;
  /** candidate_matches.stage, only when the match is client-visible */
  matchStage?: string | null;
  /** Whether the match has been shared with the employer. */
  matchVisible?: boolean;
  /** Interview state derived from the interviews rows. */
  interviewState?: "none" | "requested" | "scheduled";
  /** Application withdrawn timestamp. */
  withdrawnAt?: string | null;
}

/** The only mapping from internal lifecycle to candidate status. */
export function toCandidateStatus(i: CandidateLifecycleInputs): CandidateStatus {
  const app = i.applicationStatus;
  if (i.withdrawnAt) return "Closed";
  if (app === "withdrawn" || app === "archived" || app === "rejected") return "Closed";
  if (i.positionStatus === "closed" || i.positionStatus === "filled") return "Closed";
  if (i.matchStage === "not_moving_forward") return "Closed";

  if (i.matchStage === "offer" || i.matchStage === "hired") return "Offer stage";
  if (
    i.interviewState === "scheduled" ||
    i.interviewState === "requested" ||
    i.matchStage === "interview_process"
  ) {
    return "Interviewing";
  }
  if (i.matchVisible || i.matchStage === "shortlisted" || i.matchStage === "delivered") {
    return "Shared with the employer";
  }
  if (app === "processing" || app === "ready_for_review" || app === "in_review") {
    return "Under review";
  }
  return "Received";
}

/** True when the candidate can still withdraw. */
export function canWithdrawFrom(status: CandidateStatus): boolean {
  return status !== "Closed";
}

/** Plain-text line for email bodies, identical wording to the screens. */
export function candidateStatusEmailLine(status: CandidateStatus): string {
  return `Current status: ${status} — ${CANDIDATE_STATUS_COPY[status].meaning}`;
}
