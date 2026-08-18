// Pre-interview consent gate — single source of truth (client-safe, pure).
//
// Product rule: a client may see a candidate's contact details and download
// their CV once the admin has published the match to that client. Publication
// sets contact_released_at in the same transaction as the visibility write, so
// from the client's point of view the release is effective immediately. The
// admin-approval gate upstream is unchanged; only already-published matches
// reach this module.

export type MatchStageLike =
  | "new"
  | "reviewing"
  | "delivered"
  | "shortlisted"
  | "interview_process"
  | "offer"
  | "hired"
  | "not_moving_forward"
  | "archived"
  | (string & {});

/** Stages that by themselves prove the candidate reached interview or beyond. */
export const INTERVIEW_OR_LATER_STAGES = ["interview_process", "offer", "hired"] as const;

export function isInterviewOrLaterStage(stage: MatchStageLike | null | undefined): boolean {
  return (INTERVIEW_OR_LATER_STAGES as readonly string[]).includes(String(stage ?? ""));
}

export type ConsentGateInput = {
  stage?: MatchStageLike | null;
  contact_released_at?: string | null;
  contact_released_by?: string | null;
  contact_release_reason?: string | null;
  /** True when an interview record exists (covers post-interview rejections). */
  has_interview?: boolean | null;
};

export type ConsentGateBasis = "published" | "interview_stage" | "explicit_release" | null;

export type ConsentGateState = {
  /** Contact details + full CV are available to the client. */
  open: boolean;
  basis: ConsentGateBasis;
  /** Short label for client surfaces. */
  clientLabel: string;
  /** Short label for admin surfaces. */
  adminLabel: string;
};

/**
 * A release is effective once it has a timestamp. Modern publish handlers set
 * contact_released_at, contact_released_by, and contact_release_reason in the
 * same transaction, so every published match is considered released. The
 * interview-stage fallback is retained for legacy matches that may pre-date the
 * timestamp field.
 */
export function cvConsentGate(input: ConsentGateInput): ConsentGateState {
  const published = Boolean(input.contact_released_at);
  const reachedInterview = isInterviewOrLaterStage(input.stage) || input.has_interview === true;
  const explicit = Boolean(input.contact_released_by) && String(input.contact_release_reason ?? "").trim().length > 0;

  if (published) {
    return {
      open: true,
      basis: "published",
      clientLabel: "Contact details released",
      adminLabel: explicit ? "Released — explicit staff release" : "Released — published to client",
    };
  }
  if (explicit) {
    return {
      open: true,
      basis: "explicit_release",
      clientLabel: "Contact details released",
      adminLabel: "Released — explicit staff release",
    };
  }
  if (reachedInterview) {
    return {
      open: true,
      basis: "interview_stage",
      clientLabel: "Contact details available",
      adminLabel: "Released — interview stage reached",
    };
  }
  return {
    open: false,
    basis: null,
    clientLabel: "Available after interview",
    adminLabel: "Blocked — pre-interview",
  };
}

/** Error code thrown by the CV download endpoint when the gate is closed. */
export const CV_GATE_ERROR_CODE = "cv_gated_pre_interview";
export const CV_GATE_ERROR_MESSAGE =
  "cv_gated_pre_interview: this candidate's CV and contact details unlock at interview stage.";
