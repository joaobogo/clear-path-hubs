// Pre-interview consent gate — single source of truth (client-safe, pure).
//
// Product rule: a client may only see a candidate's contact details and
// download their CV once EITHER
//   (a) the candidate has actually reached the interview stage (or later), OR
//   (b) a member of staff performed an explicit, individually audited release
//       (an actor is recorded AND a reason was given).
//
// Blanket/bulk releases (no actor recorded) do NOT satisfy the policy: they are
// treated as if the release never happened. Every surface — client list, client
// detail, and the CV download server function — derives its state from this
// module so hidden buttons can never be the only protection.

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

export type ConsentGateBasis = "interview_stage" | "explicit_release" | null;

export type ConsentGateState = {
  /** Contact details + full CV are available to the client. */
  open: boolean;
  basis: ConsentGateBasis;
  /** Present when a release timestamp exists but does not satisfy the policy. */
  blanket_release: boolean;
  /** Short label for client surfaces. */
  clientLabel: string;
  /** Short label for admin surfaces. */
  adminLabel: string;
};

/**
 * A release counts only when an actor is recorded. Bulk/seeded releases write a
 * timestamp with no `contact_released_by`, so they are rejected here.
 */
export function isExplicitAuditedRelease(input: ConsentGateInput): boolean {
  if (!input.contact_released_at) return false;
  if (!input.contact_released_by) return false;
  return String(input.contact_release_reason ?? "").trim().length > 0;
}

export function cvConsentGate(input: ConsentGateInput): ConsentGateState {
  const explicit = isExplicitAuditedRelease(input);
  const reachedInterview = isInterviewOrLaterStage(input.stage) || input.has_interview === true;
  const blanket = Boolean(input.contact_released_at) && !explicit;

  if (explicit) {
    return {
      open: true,
      basis: "explicit_release",
      blanket_release: false,
      clientLabel: "Contact details released",
      adminLabel: "Released — explicit staff release",
    };
  }
  if (reachedInterview) {
    return {
      open: true,
      basis: "interview_stage",
      blanket_release: blanket,
      clientLabel: "Contact details available",
      adminLabel: "Released — interview stage reached",
    };
  }
  return {
    open: false,
    basis: null,
    blanket_release: blanket,
    clientLabel: "Available after interview",
    adminLabel: "Blocked — pre-interview",
  };
}

/** Error code thrown by the CV download endpoint when the gate is closed. */
export const CV_GATE_ERROR_CODE = "cv_gated_pre_interview";
export const CV_GATE_ERROR_MESSAGE =
  "cv_gated_pre_interview: this candidate's CV and contact details unlock at interview stage.";
