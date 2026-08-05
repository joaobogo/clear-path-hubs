/**
 * Candidate next-action derivation — pure, deterministic, no I/O.
 *
 * The single next step is derived from the pipeline stage plus the presence or
 * absence of the record that stage expects (score run, approval, client
 * decision, interview, scorecard, hire record). When the facts disagree with
 * the stage, we say so ("unclear") instead of guessing a step.
 *
 * Deliberately absent: any AI recommendation and any confidence percentage.
 */

export type OwnerSide = "us" | "client" | "candidate" | "system" | "none" | "unclear";

export type NextActionKind =
  | { kind: "none" }
  | { kind: "navigate"; tab: string }
  | { kind: "approve_score" }
  | { kind: "publish_to_client" }
  | { kind: "follow_up"; taskType: string; title: string };

export type NextAction = {
  /** Stable key — used for task metadata and QA hooks. */
  step: string;
  stage: string;
  owner: OwnerSide;
  /** One-line statement of the single next step. */
  step_label: string;
  /** Why this is the next step, in plain terms. */
  because: string;
  /** When the wait for this step started. Null when nothing is waiting. */
  waiting_since: string | null;
  action: NextActionKind;
  action_label: string | null;
  /** Set when the records contradict the stage; the bar shows this verbatim. */
  ambiguity: string | null;
};

export type NextActionFacts = {
  stage: string;
  processing_state: string;
  admin_status: string;
  client_visibility: string;
  integrity_status: string | null;
  has_score_run: boolean;
  delivered_at: string | null;
  processing_updated_at: string | null;
  stage_changed_at: string | null;
  created_at: string | null;
  /** Latest non-reversed client decision, if any. */
  last_decision: { decision: string; created_at: string } | null;
  interviews: { total: number; upcoming: number; completed: number; last_completed_at: string | null };
  scorecards: number;
  hire_record: { status: string; created_at: string } | null;
};

const OWNER_LABEL: Record<OwnerSide, string> = {
  us: "Us (TaaSFlow)",
  client: "Client",
  candidate: "Candidate",
  system: "Pipeline",
  none: "Nobody",
  unclear: "Unclear",
};

export function ownerLabel(owner: OwnerSide): string {
  return OWNER_LABEL[owner] ?? owner;
}

const IN_FLIGHT = new Set(["queued", "parsing", "enriching", "ready_to_score"]);
const NEEDS_REPAIR = new Set([
  "failed",
  "provider_blocked",
  "manual_review_required",
  "ocr_required",
]);
const CLOSED_STAGES = new Set(["not_moving_forward", "archived"]);

const ADVANCE_DECISIONS = new Set(["shortlist", "advance", "interview", "offer", "hire", "hired"]);

function firstTs(...values: Array<string | null | undefined>): string | null {
  for (const v of values) if (v) return v;
  return null;
}

/** Human-readable wait, e.g. "3d 4h". Returns null when there is no start. */
export function waitingFor(since: string | null, now = Date.now()): string | null {
  if (!since) return null;
  const t = new Date(since).getTime();
  if (!Number.isFinite(t)) return null;
  const ms = Math.max(0, now - t);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Derives the one next step. Never returns more than one action. */
export function deriveNextAction(f: NextActionFacts): NextAction {
  const base = {
    stage: f.stage,
    ambiguity: null as string | null,
  };

  // Closed stages: nothing is owed by anyone.
  if (CLOSED_STAGES.has(f.stage)) {
    return {
      ...base,
      step: "closed",
      owner: "none",
      step_label: "No action required",
      because:
        f.stage === "archived"
          ? "This candidate is archived for this role."
          : "This candidate is marked as not moving forward.",
      waiting_since: null,
      action: { kind: "none" },
      action_label: null,
    };
  }

  // Hired: only unclear if the hire record is missing.
  if (f.stage === "hired") {
    if (!f.hire_record) {
      return {
        ...base,
        step: "hired_without_record",
        owner: "unclear",
        step_label: "State is unclear — stage says hired, no hire record exists",
        because:
          "The stage was set to hired but no hire record was created, so the start date and guarantee period are unknown.",
        waiting_since: firstTs(f.stage_changed_at, f.delivered_at),
        action: { kind: "navigate", tab: "journey" },
        action_label: "Open journey to resolve",
        ambiguity:
          "Stage is hired but there is no hire record. Record the hire or move the stage back.",
      };
    }
    return {
      ...base,
      step: "hired",
      owner: "none",
      step_label: "No action required",
      because: "Hire is recorded for this role.",
      waiting_since: null,
      action: { kind: "none" },
      action_label: null,
    };
  }

  // Processing must finish before anything else can be owed.
  if (NEEDS_REPAIR.has(f.processing_state)) {
    return {
      ...base,
      step: "repair_processing",
      owner: "us",
      step_label: "Repair processing and review evidence",
      because: `Processing stopped in state "${f.processing_state}", so there is no usable score yet.`,
      waiting_since: firstTs(f.processing_updated_at, f.created_at),
      action: { kind: "navigate", tab: "evidence" },
      action_label: "Review evidence",
    };
  }

  if (IN_FLIGHT.has(f.processing_state)) {
    return {
      ...base,
      step: "processing_running",
      owner: "system",
      step_label: "Processing in progress — no action yet",
      because: `The CV pipeline is in state "${f.processing_state}".`,
      waiting_since: firstTs(f.processing_updated_at, f.created_at),
      action: { kind: "navigate", tab: "cv" },
      action_label: "Open CV & parsed",
    };
  }

  // Scored but not approved for the client.
  if (f.admin_status !== "approved") {
    if (!f.has_score_run) {
      return {
        ...base,
        step: "scored_without_run",
        owner: "unclear",
        step_label: "State is unclear — marked scored with no score run",
        because: "Processing state is scored but no score run is attached to this candidate.",
        waiting_since: firstTs(f.processing_updated_at, f.created_at),
        action: { kind: "navigate", tab: "score" },
        action_label: "Open score",
        ambiguity:
          "Processing says scored but there is no score run. Re-score before approving.",
      };
    }
    return {
      ...base,
      step: "approve_score",
      owner: "us",
      step_label: "Approve the score for client release",
      because: "Scoring is complete and awaiting an admin approval decision.",
      waiting_since: firstTs(f.processing_updated_at, f.created_at),
      action: { kind: "approve_score" },
      action_label: "Approve score",
    };
  }

  // Approved but not published.
  if (f.client_visibility !== "visible") {
    return {
      ...base,
      step: "publish_to_client",
      owner: "us",
      step_label: "Publish this candidate to the client",
      because: "The score is approved but the candidate is still hidden from the client.",
      waiting_since: firstTs(f.processing_updated_at, f.stage_changed_at),
      action: { kind: "publish_to_client" },
      action_label: "Publish to client",
    };
  }

  const decision = f.last_decision;

  // Interview stage rules.
  if (f.stage === "interview_process") {
    if (f.interviews.total === 0) {
      return {
        ...base,
        step: "interview_stage_without_interview",
        owner: "unclear",
        step_label: "State is unclear — interview stage with no interview record",
        because: "The stage says interview process but no interview has been created.",
        waiting_since: firstTs(f.stage_changed_at, f.delivered_at),
        action: { kind: "follow_up", taskType: "interview_scheduling", title: "Create the interview record" },
        action_label: "Assign follow-up",
        ambiguity:
          "Stage is interview process but no interview exists. Create the interview or move the stage back.",
      };
    }
    if (f.interviews.upcoming > 0) {
      return {
        ...base,
        step: "await_interview",
        owner: "candidate",
        step_label: "Interview scheduled — nothing owed until it happens",
        because: "An interview is booked and still in the future.",
        waiting_since: firstTs(f.stage_changed_at),
        action: { kind: "navigate", tab: "journey" },
        action_label: "Open journey",
      };
    }
    if (f.interviews.completed > 0 && f.scorecards === 0) {
      return {
        ...base,
        step: "collect_scorecard",
        owner: "client",
        step_label: "Collect interview feedback (scorecard)",
        because: "The interview is complete and no scorecard has been submitted.",
        waiting_since: firstTs(f.interviews.last_completed_at, f.stage_changed_at),
        action: {
          kind: "follow_up",
          taskType: "feedback_submission",
          title: "Chase interview scorecard",
        },
        action_label: "Assign follow-up",
      };
    }
    return {
      ...base,
      step: "await_post_interview_decision",
      owner: "client",
      step_label: "Await the client's post-interview decision",
      because: "Interview feedback is in and no advance or reject decision has been recorded since.",
      waiting_since: firstTs(f.interviews.last_completed_at, f.stage_changed_at),
      action: {
        kind: "follow_up",
        taskType: "candidate_review",
        title: "Chase post-interview decision",
      },
      action_label: "Assign follow-up",
    };
  }

  if (f.stage === "offer") {
    if (!f.hire_record) {
      return {
        ...base,
        step: "record_offer",
        owner: "us",
        step_label: "Record the offer and its outcome",
        because: "The stage is offer but no offer or hire record exists to track it.",
        waiting_since: firstTs(f.stage_changed_at),
        action: { kind: "navigate", tab: "journey" },
        action_label: "Open journey",
      };
    }
    if (["accepted", "hired"].includes(f.hire_record.status)) {
      return {
        ...base,
        step: "offer_accepted_stage_lagging",
        owner: "unclear",
        step_label: "State is unclear — offer accepted but stage is still offer",
        because: `The hire record status is "${f.hire_record.status}" while the stage is still offer.`,
        waiting_since: firstTs(f.hire_record.created_at, f.stage_changed_at),
        action: { kind: "navigate", tab: "journey" },
        action_label: "Open journey",
        ambiguity:
          "The hire record and the stage disagree. Move the stage to hired or correct the hire record.",
      };
    }
    return {
      ...base,
      step: "await_offer_outcome",
      owner: "candidate",
      step_label: "Await the candidate's offer response",
      because: `Offer is at status "${f.hire_record.status}".`,
      waiting_since: firstTs(f.hire_record.created_at, f.stage_changed_at),
      action: {
        kind: "follow_up",
        taskType: "offer_decision",
        title: "Chase offer response",
      },
      action_label: "Assign follow-up",
    };
  }

  if (f.stage === "shortlisted") {
    if (f.interviews.total > 0) {
      return {
        ...base,
        step: "shortlisted_with_interview",
        owner: "unclear",
        step_label: "State is unclear — shortlisted but an interview already exists",
        because: "An interview record exists while the stage is still shortlisted.",
        waiting_since: firstTs(f.stage_changed_at),
        action: { kind: "navigate", tab: "journey" },
        action_label: "Open journey",
        ambiguity:
          "Interview exists but the stage is shortlisted. Move the stage to interview process.",
      };
    }
    return {
      ...base,
      step: "schedule_interview",
      owner: "us",
      step_label: "Set up the interview with the client",
      because: "The client shortlisted this candidate and no interview has been arranged.",
      waiting_since: firstTs(decision?.created_at, f.stage_changed_at, f.delivered_at),
      action: {
        kind: "follow_up",
        taskType: "interview_scheduling",
        title: "Arrange interview",
      },
      action_label: "Assign follow-up",
    };
  }

  // Delivered / new / reviewing with the candidate already visible to the client.
  if (!decision) {
    if (f.stage === "new" || f.stage === "reviewing") {
      return {
        ...base,
        step: "delivered_stage_lagging",
        owner: "unclear",
        step_label: `State is unclear — visible to the client while stage is "${f.stage}"`,
        because:
          "The candidate is approved and published but the stage has not moved to delivered.",
        waiting_since: firstTs(f.delivered_at, f.processing_updated_at),
        action: { kind: "navigate", tab: "preview" },
        action_label: "Open client preview",
        ambiguity:
          "Published to the client but the stage still says " +
          f.stage +
          ". Correct the stage before chasing a decision.",
      };
    }
    return {
      ...base,
      step: "await_client_decision",
      owner: "client",
      step_label: "Await the client's shortlist decision",
      because: "The candidate is with the client and no decision has been recorded.",
      waiting_since: firstTs(f.delivered_at, f.stage_changed_at),
      action: {
        kind: "follow_up",
        taskType: "candidate_review",
        title: "Chase client decision",
      },
      action_label: "Assign follow-up",
    };
  }

  // A decision exists but the stage did not follow it.
  if (ADVANCE_DECISIONS.has(decision.decision)) {
    return {
      ...base,
      step: "decision_stage_mismatch",
      owner: "unclear",
      step_label: `State is unclear — client decided "${decision.decision}" while stage is "${f.stage}"`,
      because: "The recorded client decision and the pipeline stage do not match.",
      waiting_since: decision.created_at,
      action: { kind: "navigate", tab: "history" },
      action_label: "Open history",
      ambiguity:
        "The latest client decision and the stage disagree. Reconcile them before acting.",
    };
  }

  return {
    ...base,
    step: "decision_recorded_no_step",
    owner: "none",
    step_label: "No action required",
    because: `The client's latest decision was "${decision.decision}".`,
    waiting_since: null,
    action: { kind: "none" },
    action_label: null,
  };
}
