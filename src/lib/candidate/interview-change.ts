/**
 * Candidate-initiated interview changes: reschedule and cancel.
 *
 * Rules this module exists to enforce:
 *   1. Both actions stay available right up to the interview start time, and
 *      not one second after.
 *   2. A request made inside twenty-four hours of the start is still allowed —
 *      the candidate is only told plainly that a new time may take longer.
 *   3. No penalty language, no required reason, no consequence for future
 *      applications. The copy below is the only copy these controls use.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type InterviewChangeAction = "reschedule" | "cancel";

export interface ChangeEligibility {
  /** Can the candidate still reschedule or cancel? */
  allowed: boolean;
  /** Inside 24 hours of the start time. Allowed, but flagged. */
  shortNotice: boolean;
  /** Why the controls are absent, in plain words. Null when allowed. */
  blockedReason: string | null;
}

export interface ChangeInput {
  /** Confirmed or held start time. Null means nothing is booked yet. */
  scheduledAt: string | null;
  /** Interview status as stored. */
  status: string;
  /** Milliseconds since epoch; injectable for tests. */
  now?: number;
}

/**
 * Controls only exist for an interview that is actually booked and still ahead
 * of us. Everything else returns `allowed: false` with a reason.
 */
export function changeEligibility(input: ChangeInput): ChangeEligibility {
  const now = input.now ?? Date.now();

  if (input.status === "cancelled") {
    return { allowed: false, shortNotice: false, blockedReason: "This interview is cancelled." };
  }
  if (input.status === "completed") {
    return { allowed: false, shortNotice: false, blockedReason: "This interview has taken place." };
  }
  if (!input.scheduledAt) {
    return { allowed: false, shortNotice: false, blockedReason: null };
  }

  const start = new Date(input.scheduledAt).getTime();
  if (!Number.isFinite(start)) {
    return { allowed: false, shortNotice: false, blockedReason: null };
  }
  if (start <= now) {
    return {
      allowed: false,
      shortNotice: false,
      blockedReason: "This interview time has passed. Message us if you still need to change it.",
    };
  }

  return { allowed: true, shortNotice: start - now < DAY_MS, blockedReason: null };
}

/** Shown when the request lands inside twenty-four hours. Never a warning. */
export const SHORT_NOTICE_NOTICE =
  "This is within 24 hours of the interview, so a new time may take longer to arrange. You can still go ahead.";

export const CHANGE_COPY: Record<
  InterviewChangeAction,
  {
    trigger: string;
    title: string;
    /** What happens next, stated plainly. */
    whatHappens: string;
    noteLabel: string;
    notePlaceholder: string;
    confirm: string;
    pending: string;
    success: string;
    /** Error copy: the interview is untouched, and we say so. */
    failure: string;
  }
> = {
  reschedule: {
    trigger: "Reschedule",
    title: "Ask for a different time",
    whatHappens:
      "This time is released and we look for new options. You'll see the new times here, and nothing else about your application changes.",
    noteLabel: "Anything that helps us pick times (optional)",
    notePlaceholder: "For example: mornings work better this week",
    confirm: "Request new times",
    pending: "Sending request…",
    success: "Request sent. We'll come back with new times.",
    failure: "We couldn't send that request. Your interview is unchanged — please try again.",
  },
  cancel: {
    trigger: "Cancel interview",
    title: "Cancel this interview",
    whatHappens:
      "The time is released and the interview is cancelled. Your application stays open, and you can apply for other roles at any time. If you want to meet later, ask for a different time instead.",
    noteLabel: "Anything you'd like us to know (optional)",
    notePlaceholder: "Optional — no reason needed",
    confirm: "Cancel interview",
    pending: "Cancelling…",
    success: "Interview cancelled.",
    failure: "We couldn't cancel that. Your interview is unchanged — please try again.",
  },
};

/** Server error codes → candidate-safe copy. */
export const CHANGE_ERROR_COPY: Record<string, string> = {
  interview_closed: "This interview is already closed. Nothing has changed.",
  interview_started: "This time has already started, so it can't be changed here.",
  not_scheduled: "There's no booked time to change yet.",
};
