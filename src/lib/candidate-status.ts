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
