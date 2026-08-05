import type { CandidateSafeStatus } from "@/lib/candidate.functions";

/** Candidate-safe status → badge tone. Design tokens only, no raw colours. */
export const CANDIDATE_STATUS_TONE: Record<CandidateSafeStatus, string> = {
  Submitted: "bg-secondary text-secondary-foreground",
  "Under review": "bg-secondary text-secondary-foreground",
  "Additional information requested": "taas-bg-warning-soft taas-fg-warning",
  Progressing: "taas-bg-info-soft taas-fg-info",
  "Interview requested": "taas-bg-info-soft taas-fg-info",
  "Interview scheduled": "taas-bg-success-soft taas-fg-success",
  Closed: "bg-muted text-muted-foreground",
  Withdrawn: "bg-muted text-muted-foreground",
};

/** Short, human explanation of what each status means for the candidate. */
export const CANDIDATE_STATUS_MEANING: Record<CandidateSafeStatus, string> = {
  Submitted: "We've received your application.",
  "Under review": "A person is reading your application.",
  "Additional information requested": "The team has asked you a question.",
  Progressing: "Your application is moving forward.",
  "Interview requested": "An interview has been requested.",
  "Interview scheduled": "Your interview is confirmed.",
  Closed: "This application is no longer active.",
  Withdrawn: "You withdrew this application.",
};

/**
 * The one line that answers "what do I do now?". A status word on its own
 * generates most support contact, so every state — including the ones where
 * we need nothing — says so explicitly. Never left blank.
 */
export const CANDIDATE_STATUS_NEXT_STEP: Record<CandidateSafeStatus, string> = {
  Submitted: "Nothing needed from you. We'll email you when there's news.",
  "Under review": "Nothing needed from you. You can still upload a newer CV.",
  "Additional information requested": "Answer the team's question to continue.",
  Progressing: "Nothing needed from you yet. Keep an eye on your inbox.",
  "Interview requested": "Accept, decline or ask for another time.",
  "Interview scheduled": "Attend at the confirmed time, or tell us if it no longer works.",
  Closed: "Nothing further for this role. You're welcome to apply to others.",
  Withdrawn: "Nothing needed. You can apply to other roles at any time.",
};

