/**
 * Pure resolution logic for the public (reference + email) application
 * status view. No database access, no server-only imports — safe for both
 * the server functions and the UI.
 */
import type { CandidateStateKey } from "./candidate-transparency";
import {
  candidateStateKey,
  candidateStatusFromFacts,
  type CandidateLifecycleFacts,
} from "./status-projection";

export interface StatusInputs {
  applicationStatus: string;
  withdrawnAt: string | null;
  positionStatus: string | null;
  matchStage: string | null;
  matchVisible: boolean;
  hasOpenInfoRequest: boolean;
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
  // Derived from the one projection of applications + candidate_matches, so the
  // reference lookup, the receipt and the portal cannot disagree.
  const facts: CandidateLifecycleFacts = {
    applicationStatus: i.applicationStatus,
    withdrawnAt: i.withdrawnAt,
    positionStatus: i.positionStatus,
    matchStage: i.matchStage,
    matchVisible: i.matchVisible,
    hasOpenInfoRequest: i.hasOpenInfoRequest,
    needsSupport: i.needsSupport,
  };
  return candidateStateKey(candidateStatusFromFacts(facts), facts);
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

// Removed: an unused export that counted "draft" as open. Nothing imported it,
// and anything that had would have accepted applications to unpublished roles.
// The two real definitions live in vocabulary.ts as POSITION_STATUSES_IN_PLAY
// and POSITION_STATUSES_HIRING.
