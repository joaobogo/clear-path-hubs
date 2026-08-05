/** Shared (client-safe) constants for the client decision backlog. */
export type OfflineDecision =
  | "shortlist"
  | "request_interview"
  | "request_information"
  | "hold"
  | "not_moving_forward"
  | "offer"
  | "hire";

export const OFFLINE_DECISION_LABEL: Record<OfflineDecision, string> = {
  shortlist: "Shortlisted",
  request_interview: "Interview requested",
  request_information: "More information requested",
  hold: "On hold",
  not_moving_forward: "Not moving forward",
  offer: "Offer",
  hire: "Hired",
};
