/**
 * Human-readable explanations for approve/publish failures.
 *
 * Backend errors arrive as machine codes, e.g.
 *   publish_blocked:run_status:running
 *   publish_failed:approve_state:invalid_canonical_state_transition: ingestion -> approved
 *   publish_failed:not_visible_after_update
 *
 * Staff need the exact reason (never a generic "approve failed"), plus whether
 * retrying can possibly help. Internal-only copy: never shown to clients or
 * candidates.
 */

import {
  CANONICAL_STATE_LABEL,
  shortestTransitionPath,
  type CanonicalScoringState,
} from "./canonical-state";

export type ApproveFailure = {
  /** Raw backend code, always surfaced so staff can quote it in an escalation. */
  raw: string;
  /** Short headline. */
  title: string;
  /** Precise explanation of what the backend rejected. */
  detail: string;
  /** True when the same click can plausibly succeed later (transient). */
  retryable: boolean;
  /** Optional next step that would unblock the approval. */
  nextStep?: string;
};

function label(state: string): string {
  return CANONICAL_STATE_LABEL[state as CanonicalScoringState] ?? state;
}

export function explainApproveFailure(message: string): ApproveFailure {
  const raw = (message || "unknown_error").trim();

  if (raw === "forbidden") {
    return {
      raw,
      title: "Not permitted",
      detail: "Your account is not platform staff, so it cannot approve scores.",
      retryable: false,
    };
  }

  if (raw === "match_not_found") {
    return {
      raw,
      title: "Candidate record missing",
      detail: "This candidate match no longer exists — it may have been deleted.",
      retryable: false,
      nextStep: "Reload the candidate database.",
    };
  }

  if (raw === "no_score_run_yet") {
    return {
      raw,
      title: "No score run to approve",
      detail: "There is no completed scoring run attached to this candidate yet.",
      retryable: false,
      nextStep: "Run scoring, then approve.",
    };
  }

  if (raw.startsWith("publish_blocked:")) {
    const reason = raw.slice("publish_blocked:".length);
    if (reason.startsWith("run_status:")) {
      const status = reason.slice("run_status:".length);
      const pending = status === "running" || status === "queued" || status === "pending";
      return {
        raw,
        title: "Score run not complete",
        detail: `The current score run is "${status}", and only completed runs can be approved.`,
        retryable: pending,
        nextStep: pending
          ? "Wait for scoring to finish, then retry."
          : "Rescore this candidate, then approve.",
      };
    }
    if (reason === "run_belongs_to_other_match" || reason === "run_position_mismatch") {
      return {
        raw,
        title: "Score run identity mismatch",
        detail:
          "The attached score run belongs to a different candidate or position, so approving it would publish the wrong evidence.",
        retryable: false,
        nextStep: "Rescore this candidate to produce a matching run.",
      };
    }
    if (reason === "disqualifying_contradiction") {
      return {
        raw,
        title: "Disqualifying contradiction",
        detail:
          "The run is flagged with a disqualifying contradiction between screening answers and evidence.",
        retryable: false,
        nextStep: "Resolve the contradiction in the Evidence tab, then rescore.",
      };
    }
    if (reason === "run_not_found") {
      return {
        raw,
        title: "Score run missing",
        detail: "The score run referenced by this candidate could not be loaded.",
        retryable: false,
        nextStep: "Rescore this candidate.",
      };
    }
    return {
      raw,
      title: "Publish gate blocked",
      detail: `The publish gate rejected this approval: ${reason}.`,
      retryable: false,
    };
  }

  if (raw.startsWith("publish_blocked:evidence_incomplete")) {
    return {
      raw,
      title: "Can't approve yet",
      detail: "Add at least one piece of evidence for every must-have requirement, or record a written override.",
      retryable: false,
      nextStep: "Open the Evidence tab and link evidence for each missing criterion.",
    };
  }

  if (raw.startsWith("publish_failed:approve_state:")) {
    const reason = raw.slice("publish_failed:approve_state:".length);
    if (reason.startsWith("no_path_from:")) {
      const from = reason.slice("no_path_from:".length);
      return {
        raw,
        title: "Workflow state cannot reach approval",
        detail: `The candidate is in "${label(from)}", which has no legal path to Approved. Retrying will fail the same way.`,
        retryable: false,
        nextStep: "Return the candidate for correction or rescore to reset the workflow.",
      };
    }
    return {
      raw,
      title: "Workflow state transition rejected",
      detail: `The database rejected a workflow step while moving this candidate to Approved: ${reason}`,
      retryable: true,
      nextStep: "Reload the candidate and retry; if it repeats, rescore to reset the workflow.",
    };
  }

  if (raw === "publish_failed:not_visible_after_update") {
    return {
      raw,
      title: "Publish did not take effect",
      detail:
        "The approval was written but the candidate did not become client-visible, so it was reported as failed.",
      retryable: true,
      nextStep: "Reload and retry; check client visibility before re-approving.",
    };
  }

  if (raw.startsWith("publish_failed:")) {
    return {
      raw,
      title: "Publish failed",
      detail: raw.slice("publish_failed:".length),
      retryable: true,
    };
  }

  if (/fetch|network|timeout|failed to fetch/i.test(raw)) {
    return {
      raw,
      title: "Network error",
      detail: "The approval request did not reach the server.",
      retryable: true,
      nextStep: "Check your connection and retry.",
    };
  }

  return {
    raw,
    title: "Approve failed",
    detail: raw,
    retryable: true,
  };
}

/**
 * Client-side preflight. Mirrors the DB transition rules so the button can be
 * disabled before a doomed request is sent. Returns null when approval looks
 * legal from the current canonical state.
 */
export function approvePreflightBlock(
  canonicalState: string | null | undefined,
): string | null {
  if (!canonicalState) return null;
  const from = canonicalState as CanonicalScoringState;
  if (!(from in CANONICAL_STATE_LABEL)) return null;
  if (from === "approved" || from === "published_to_client") return null;
  const path = shortestTransitionPath(from, "approved");
  if (path) return null;
  return `Workflow state "${label(from)}" has no legal path to Approved. Return for correction or rescore first.`;
}
