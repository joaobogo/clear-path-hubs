/**
 * End-to-end test for the "approve score" workflow.
 *
 * The real approval runs inside the `approve_candidate_match` RPC, which:
 *   1. locks the match row,
 *   2. walks the *shortest legal* canonical-state path to `approved`
 *      (the DB trigger only allows single legal hops),
 *   3. publishes to the client (`published_to_client` + visible),
 *   4. is idempotent — a repeated approval is a no-op, never a failure.
 *
 * This test reproduces the same contract against a faithful in-memory mirror of
 * the DB trigger (`tg_candidate_matches_canonical_state`) so every legal start
 * state is exercised and the final approved/published state is verified, plus
 * the client-side preflight and failure mapping used by the Approve button.
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  CANONICAL_SCORING_STATES,
  shortestTransitionPath,
  type CanonicalScoringState,
} from "../canonical-state";
import { approvePreflightBlock, explainApproveFailure } from "../approve-failure";

type MatchRow = {
  id: string;
  canonical_state: CanonicalScoringState;
  admin_status: "pending" | "approved";
  client_visibility: "hidden" | "visible";
  approved_score_run_id: string | null;
  current_score_run_id: string;
  decisions: string[];
  audit: { event: string; before: string; after: string; trace_id: string; path: string[] }[];
};

/** Mirror of the DB trigger: single legal hop only, otherwise it raises. */
function applyTransition(row: MatchRow, to: CanonicalScoringState) {
  if (row.canonical_state === to) return;
  if (!ALLOWED_TRANSITIONS[row.canonical_state].includes(to)) {
    throw new Error(
      `invalid_canonical_state_transition: ${row.canonical_state} -> ${to}`,
    );
  }
  row.canonical_state = to;
}

/** Mirror of `public.approve_candidate_match` (single transaction, idempotent). */
function approveCandidateMatch(row: MatchRow, runId: string, traceId: string) {
  const before = row.canonical_state;

  // Idempotency: already published with the same run → no-op success.
  if (
    row.client_visibility === "visible" &&
    row.approved_score_run_id === runId &&
    (row.canonical_state === "approved" || row.canonical_state === "published_to_client")
  ) {
    row.audit.push({ event: "score_approval_noop", before, after: row.canonical_state, trace_id: traceId, path: [] });
    return { already: true, canonical_state: row.canonical_state, client_visibility: row.client_visibility, state_path: [] as string[] };
  }

  const toApproved = shortestTransitionPath(row.canonical_state, "approved");
  if (!toApproved) {
    throw new Error(`invalid_canonical_state_transition: ${row.canonical_state} -> approved`);
  }
  const path = [...toApproved, "published_to_client" as CanonicalScoringState];
  for (const step of path) applyTransition(row, step);

  row.admin_status = "approved";
  row.client_visibility = "visible";
  row.approved_score_run_id = runId;
  if (!row.decisions.includes(runId)) row.decisions.push(runId);
  row.audit.push({ event: "score_approved", before, after: row.canonical_state, trace_id: traceId, path });

  return { already: false, canonical_state: row.canonical_state, client_visibility: row.client_visibility, state_path: path };
}

function makeMatch(state: CanonicalScoringState): MatchRow {
  return {
    id: "match-1",
    canonical_state: state,
    admin_status: "pending",
    client_visibility: "hidden",
    approved_score_run_id: null,
    current_score_run_id: "run-1",
    decisions: [],
    audit: [],
  };
}

const APPROVABLE = CANONICAL_SCORING_STATES.filter(
  (s) => shortestTransitionPath(s, "approved") !== null || s === "approved",
);

describe("approve score workflow (e2e)", () => {
  it("covers every canonical state as either approvable or preflight-blocked", () => {
    for (const state of CANONICAL_SCORING_STATES) {
      const block = approvePreflightBlock(state);
      const approvable = APPROVABLE.includes(state);
      expect(Boolean(block), `${state} preflight`).toBe(!approvable);
    }
  });

  it.each(APPROVABLE)("approves and publishes from %s", (state) => {
    const row = makeMatch(state);
    const result = approveCandidateMatch(row, "run-1", `review-approve-${state}`);

    expect(result.already).toBe(false);
    expect(row.canonical_state).toBe("published_to_client");
    expect(row.client_visibility).toBe("visible");
    expect(row.admin_status).toBe("approved");
    expect(row.approved_score_run_id).toBe("run-1");

    // Every hop taken was individually legal for the trigger.
    let cursor = state;
    for (const step of result.state_path as CanonicalScoringState[]) {
      expect(ALLOWED_TRANSITIONS[cursor], `${cursor} -> ${step}`).toContain(step);
      cursor = step;
    }
    expect(cursor).toBe("published_to_client");
  });

  it("walks ingestion -> approved one legal hop at a time (regression)", () => {
    const row = makeMatch("ingestion");
    const result = approveCandidateMatch(row, "run-1", "trace-ingestion");
    expect(result.state_path).toEqual([
      "evidence_extraction",
      "provisional_scoring",
      "human_review",
      "approved",
      "published_to_client",
    ]);
    expect(row.canonical_state).toBe("published_to_client");
  });

  it("rejects the illegal single-jump ingestion -> approved", () => {
    const row = makeMatch("ingestion");
    expect(() => applyTransition(row, "approved")).toThrow(
      /invalid_canonical_state_transition: ingestion -> approved/,
    );
    expect(row.canonical_state).toBe("ingestion");
  });

  it("is idempotent across repeated approvals", () => {
    const row = makeMatch("human_review");
    approveCandidateMatch(row, "run-1", "trace-1");
    const second = approveCandidateMatch(row, "run-1", "trace-2");
    const third = approveCandidateMatch(row, "run-1", "trace-3");

    expect(second.already).toBe(true);
    expect(third.already).toBe(true);
    expect(row.canonical_state).toBe("published_to_client");
    expect(row.client_visibility).toBe("visible");
    expect(row.decisions).toEqual(["run-1"]); // decision inserted at most once
    expect(row.audit.map((a) => a.event)).toEqual([
      "score_approved",
      "score_approval_noop",
      "score_approval_noop",
    ]);
  });

  it("records an audit trail with actor trace, before/after states and path", () => {
    const row = makeMatch("provisional_scoring");
    approveCandidateMatch(row, "run-1", "review-approve-abc");
    const entry = row.audit[0];
    expect(entry.event).toBe("score_approved");
    expect(entry.before).toBe("provisional_scoring");
    expect(entry.after).toBe("published_to_client");
    expect(entry.trace_id).toBe("review-approve-abc");
    expect(entry.path.length).toBeGreaterThan(0);
  });

  it("blocks terminal states with no legal path and surfaces the reason", () => {
    const row = makeMatch("superseded");
    expect(approvePreflightBlock("superseded")).toMatch(/no legal path to Approved/i);
    expect(() => approveCandidateMatch(row, "run-1", "trace-x")).toThrow(
      /invalid_canonical_state_transition/,
    );
    expect(row.canonical_state).toBe("superseded");
  });

  it("maps backend approval errors to retry guidance", () => {
    const failed = explainApproveFailure(
      "publish_failed:approve_state:invalid_canonical_state_transition: ingestion -> approved",
    );
    expect(failed.title).toBeTruthy();
    expect(failed.raw).toContain("invalid_canonical_state_transition");

    const network = explainApproveFailure("Failed to fetch");
    expect(network.retryable).toBe(true);
  });
});
