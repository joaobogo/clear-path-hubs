/**
 * Pure resolution logic for the public (reference + email) application
 * status view. No database access, no server-only imports — safe for both
 * the server functions and the UI.
 */
import type { CandidateStateKey } from "./candidate-transparency";

export interface StatusInputs {
  applicationStatus: string;
  withdrawnAt: string | null;
  positionStatus: string | null;
  matchStage: string | null;
  matchVisible: boolean;
  hasOpenInfoRequest: boolean;
  interviewScheduled: boolean;
  interviewRequested: boolean;
  /** Processing failed or a file could not be read. */
  needsSupport: boolean;
}

export type JourneyKey = "received" | "review" | "shared" | "interview" | "decision";

export interface JourneyStep {
  key: JourneyKey;
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming" | "closed";
}

const JOURNEY: Array<{ key: JourneyKey; label: string; detail: string }> = [
  { key: "received", label: "Received", detail: "Your application and CV are with us." },
  {
    key: "review",
    label: "Under review",
    detail: "A reviewer reads your CV and answers against the role's requirements.",
  },
  {
    key: "shared",
    label: "Shared with the hiring team",
    detail: "Your profile has been passed to the employer for this role.",
  },
  {
    key: "interview",
    label: "Interview stage",
    detail: "The hiring team is speaking with you about the role.",
  },
  { key: "decision", label: "Decision", detail: "An outcome has been reached and emailed to you." },
];

export function resolveCandidateState(i: StatusInputs): CandidateStateKey {
  if (i.withdrawnAt) return "withdrawn";
  if (i.applicationStatus === "rejected" || i.matchStage === "not_moving_forward") {
    return "decision_made";
  }
  if (i.positionStatus === "closed" || i.positionStatus === "filled") return "role_closed";
  if (i.hasOpenInfoRequest) return "information_required";
  if (i.needsSupport) return "support_required";
  if (i.interviewScheduled || i.interviewRequested) return "interview_stage";
  if (i.matchStage === "offer" || i.matchStage === "hired") return "decision_made";
  if (i.matchStage === "interview_process") return "interview_stage";
  if (i.applicationStatus === "processing" || i.applicationStatus === "ready_for_review") {
    return "under_review";
  }
  if (i.matchVisible) return "under_review";
  return "application_received";
}

function reachedKey(state: CandidateStateKey, i: StatusInputs): JourneyKey {
  if (state === "interview_stage") return "interview";
  if (state === "decision_made") return "decision";
  if (i.matchVisible || i.matchStage === "delivered" || i.matchStage === "shortlisted") {
    return "shared";
  }
  if (state === "application_received") return "received";
  return "review";
}

export function buildJourney(state: CandidateStateKey, i: StatusInputs): JourneyStep[] {
  const closed = state === "withdrawn" || state === "role_closed" || state === "decision_made";
  const reached = reachedKey(state, i);
  const at = JOURNEY.findIndex((s) => s.key === reached);
  return JOURNEY.map((s, idx) => ({
    key: s.key,
    label: s.label,
    detail: s.detail,
    state: closed
      ? idx <= at
        ? ("done" as const)
        : ("closed" as const)
      : idx < at
        ? ("done" as const)
        : idx === at
          ? ("current" as const)
          : ("upcoming" as const),
  }));
}

export const OPEN_POSITION_STATUSES = ["active", "approved", "paused", "draft"];
