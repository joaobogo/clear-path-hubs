import { statusLabel } from "@/lib/vocabulary";
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
  shortlist: statusLabel("shortlisted"),
  request_interview: "Moved to interview stage",
  request_information: "More information requested",
  hold: statusLabel("on_hold"),
  not_moving_forward: statusLabel("not_moving_forward"),
  offer: statusLabel("offer"),
  hire: statusLabel("hired"),
};
