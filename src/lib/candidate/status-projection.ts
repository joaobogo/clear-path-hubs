/**
 * The one projection of a candidate's application.
 *
 * `applications` and `candidate_matches` are the truth. Everything a candidate
 * reads about where they stand — the portal list, the application page, the
 * public reference lookup, candidate emails and candidate notifications — is a
 * projection of those rows produced here, exactly as `toClientCandidateDTO` is
 * the single projection for client surfaces.
 *
 * Consequences, deliberately:
 *   - No table and no view stores a candidate-facing status string. An admin
 *     action that changes a match row changes what the candidate reads on the
 *     next load, with no second write.
 *   - Publishing a candidate only flips `candidate_matches.client_visibility`
 *     (in its one existing write path). This function reads that flip.
 *
 * Pure module: no database access, no server-only imports, so the portal, the
 * email builders and the tests all call the same code.
 */
import type { CandidateStateKey } from "./candidate-transparency";
import {
  CANDIDATE_STATUS_COPY,
  canWithdrawFrom,
  candidateStatusEmailLine,
  toCandidateStatus,
  type CandidateStatus,
} from "./status-vocabulary";

export type CandidateInterviewState = "none" | "requested" | "scheduled";

/** A raw `interviews` row, as read from the database. */
export type RawInterviewRow = {
  status?: string | null;
  scheduled_at?: string | null;
};

/** A raw `candidate_matches` row, as read from the database. */
export type RawMatchRow = {
  id?: string | null;
  stage?: string | null;
  client_visibility?: string | null;
  updated_at?: string | null;
  interviews?: RawInterviewRow | RawInterviewRow[] | null;
};

/** A raw `applications` row with its embedded position and match rows. */
export type RawApplicationRow = {
  status?: string | null;
  withdrawn_at?: string | null;
  positions?: { status?: string | null } | null;
  candidate_matches?: RawMatchRow | RawMatchRow[] | null;
};

/** Facts that live in other rows and cannot be read off the application. */
export type CandidateStatusExtras = {
  /** An unanswered `candidate_info_requests` row for this application. */
  hasOpenInfoRequest?: boolean;
  /** A document we could not read — the candidate must act for us to continue. */
  needsSupport?: boolean;
  /** Interviews, when they were fetched separately from the match rows. */
  interviews?: RawInterviewRow[];
};

export type CandidateStatusProjection = {
  /** The candidate-safe status word. The only one any surface may show. */
  status: CandidateStatus;
  /** What that status means, one line. */
  meaning: string;
  /** What the candidate should do now — never blank. */
  next_step: string;
  /** Chip tone; decoration only, the word carries the meaning. */
  tone: string;
  /** Plain-text line for email bodies, identical wording to the screens. */
  email_line: string;
  can_withdraw: boolean;
  /** The more detailed journey key the reference lookup and receipt render. */
  state: CandidateStateKey;
  interview_state: CandidateInterviewState;
  /** Truth read off the rows, exposed so callers never re-derive it. */
  match_visible: boolean;
  match_stage: string | null;
  role_closed: boolean;
  info_requested: boolean;
};

function rows<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Interview state from the raw interview rows. Cancelled rows do not count. */
export function candidateInterviewState(list: RawInterviewRow[]): CandidateInterviewState {
  const live = list.filter((i) => i.status !== "cancelled" && i.status !== "declined");
  if (live.some((i) => i.scheduled_at)) return "scheduled";
  if (live.length > 0) return "requested";
  return "none";
}

/** The lifecycle facts, read once off the raw rows. */
export type CandidateLifecycleFacts = {
  applicationStatus: string;
  withdrawnAt: string | null;
  positionStatus: string | null;
  matchStage: string | null;
  matchVisible: boolean;
  interviewState: CandidateInterviewState;
  hasOpenInfoRequest: boolean;
  needsSupport: boolean;
};

export function candidateLifecycleFacts(
  app: RawApplicationRow,
  extras: CandidateStatusExtras = {},
): CandidateLifecycleFacts {
  const matches = rows(app.candidate_matches);
  const visible = matches.find((m) => m.client_visibility === "visible");
  const interviews =
    extras.interviews ?? matches.flatMap((m) => rows(m.interviews));
  return {
    applicationStatus: app.status ?? "submitted",
    withdrawnAt: app.withdrawn_at ?? null,
    positionStatus: app.positions?.status ?? null,
    matchStage: visible?.stage ?? matches[0]?.stage ?? null,
    matchVisible: Boolean(visible),
    interviewState: candidateInterviewState(interviews),
    hasOpenInfoRequest: Boolean(extras.hasOpenInfoRequest),
    needsSupport: Boolean(extras.needsSupport),
  };
}

/** The detailed journey key, derived from the same status — never in parallel. */
export function candidateStateKey(
  status: CandidateStatus,
  f: CandidateLifecycleFacts,
): CandidateStateKey {
  if (f.withdrawnAt || f.applicationStatus === "withdrawn") return "withdrawn";
  if (f.applicationStatus === "rejected" || f.matchStage === "not_moving_forward") {
    return "decision_made";
  }
  if (f.positionStatus === "closed" || f.positionStatus === "filled") return "role_closed";
  if (f.hasOpenInfoRequest) return "information_required";
  if (f.needsSupport) return "support_required";
  switch (status) {
    case "Interviewing":
      return "interview_stage";
    case "Offer stage":
      return "decision_made";
    case "Closed":
      return "decision_made";
    case "Received":
      return "application_received";
    default:
      return "under_review";
  }
}

/** Status only, from already-extracted facts. */
export function candidateStatusFromFacts(f: CandidateLifecycleFacts): CandidateStatus {
  return toCandidateStatus({
    applicationStatus: f.applicationStatus,
    positionStatus: f.positionStatus,
    matchStage: f.matchStage,
    matchVisible: f.matchVisible,
    interviewState: f.interviewState,
    withdrawnAt: f.withdrawnAt,
  });
}

/**
 * The single projection. Give it the raw rows; it answers with every
 * candidate-facing fact about status, and nothing internal.
 */
export function toCandidateStatusDTO(
  app: RawApplicationRow,
  extras: CandidateStatusExtras = {},
): CandidateStatusProjection {
  const f = candidateLifecycleFacts(app, extras);
  const status = candidateStatusFromFacts(f);
  const copy = CANDIDATE_STATUS_COPY[status];
  return {
    status,
    meaning: copy.meaning,
    next_step: copy.nextStep,
    tone: copy.tone,
    email_line: candidateStatusEmailLine(status),
    can_withdraw: canWithdrawFrom(status),
    state: candidateStateKey(status, f),
    interview_state: f.interviewState,
    match_visible: f.matchVisible,
    match_stage: f.matchStage,
    role_closed: f.positionStatus === "closed" || f.positionStatus === "filled",
    info_requested: f.hasOpenInfoRequest,
  };
}
