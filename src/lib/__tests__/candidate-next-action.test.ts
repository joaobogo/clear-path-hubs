/**
 * The engine that decides "what happens next" for every candidate, and which
 * had no tests at all.
 *
 * These cover the three vocabulary defects it shipped with — a closed-stage set
 * naming a position status instead of a real stage, an advancing-decision set
 * missing the most common decision a client can take, and a pre-delivery check
 * naming a stage that does not exist — plus the invariant the whole module
 * promises: exactly one next step, never a guess.
 */
import { describe, expect, it } from "vitest";
import { deriveNextAction, type NextActionFacts } from "@/lib/candidate-next-action";
import { PIPELINE_STAGE_VOCABULARY } from "@/lib/vocabulary";

function facts(over: Partial<NextActionFacts> = {}): NextActionFacts {
  return {
    stage: "delivered",
    processing_state: "scored",
    admin_status: "approved",
    client_visibility: "visible",
    integrity_status: null,
    has_score_run: true,
    delivered_at: "2026-08-01T10:00:00.000Z",
    processing_updated_at: "2026-08-01T09:00:00.000Z",
    stage_changed_at: "2026-08-01T10:00:00.000Z",
    created_at: "2026-07-30T10:00:00.000Z",
    last_decision: null,
    interviews: { total: 0, upcoming: 0, completed: 0, last_completed_at: null },
    scorecards: 0,
    hire_record: null,
    ...over,
  };
}

describe("closed stages", () => {
  it("asks nobody to act on a candidate who withdrew", () => {
    const a = deriveNextAction(facts({ stage: "withdrawn" }));
    expect(a.step).toBe("closed");
    expect(a.owner).toBe("none");
    expect(a.action).toEqual({ kind: "none" });
    expect(a.because).toMatch(/withdrew/i);
  });

  it("asks nobody to act on a rejected candidate", () => {
    const a = deriveNextAction(facts({ stage: "not_moving_forward" }));
    expect(a.step).toBe("closed");
    expect(a.owner).toBe("none");
    expect(a.because).toMatch(/not moving forward/i);
  });

  it("does not treat a live stage as closed", () => {
    expect(deriveNextAction(facts({ stage: "shortlisted" })).step).not.toBe("closed");
  });
});

describe("advancing client decisions", () => {
  const decidedAt = "2026-08-02T10:00:00.000Z";

  it("treats a requested interview as forward movement", () => {
    // request_interview is the enum value; the set previously listed
    // "interview", which does not exist, so the most common advancing decision
    // a client can take counted as no decision at all.
    const a = deriveNextAction(
      facts({
        stage: "shortlisted",
        last_decision: { decision: "request_interview", created_at: decidedAt },
      }),
    );
    expect(a.step).not.toBe("await_client_decision");
  });

  it("treats a rejection as not advancing", () => {
    const a = deriveNextAction(
      facts({
        stage: "delivered",
        last_decision: { decision: "not_moving_forward", created_at: decidedAt },
      }),
    );
    expect(a.owner).not.toBe("client");
  });
});

describe("stage/visibility contradictions are reported, not guessed", () => {
  for (const stage of ["new", "sourced", "screening", "in_review"]) {
    it(`flags "${stage}" while the client can already see the candidate`, () => {
      const a = deriveNextAction(
        facts({ stage, client_visibility: "visible", last_decision: null }),
      );
      expect(a.step).toBe("delivered_stage_lagging");
      expect(a.owner).toBe("unclear");
      expect(a.step_label).toContain(stage);
    });
  }
});

describe("never invites an approval mid-recompute", () => {
  // Approving a score that is being replaced is the one irreversible mistake
  // this screen can invite. Every state where the pipeline still owns the
  // record must own the next action too.
  const IN_FLIGHT = ["queued", "parsing", "parsed", "enriching", "ready_to_score", "scoring"];

  for (const state of IN_FLIGHT) {
    it(`offers no approval while processing_state is "${state}"`, () => {
      const a = deriveNextAction(
        facts({ processing_state: state, admin_status: "pending", has_score_run: true }),
      );
      expect(a.step).toBe("processing_running");
      expect(a.owner).toBe("system");
      expect(a.action.kind).not.toBe("approve_score");
    });
  }

  it("does offer approval once scoring has finished", () => {
    const a = deriveNextAction(
      facts({ processing_state: "scored", admin_status: "pending", has_score_run: true }),
    );
    expect(a.step).toBe("approve_score");
    expect(a.action).toEqual({ kind: "approve_score" });
  });
});

describe("invariants", () => {
  it("returns exactly one action for every stage in the vocabulary", () => {
    for (const stage of Object.keys(PIPELINE_STAGE_VOCABULARY)) {
      const a = deriveNextAction(facts({ stage }));
      expect(a.step, `${stage} produced no step`).toBeTruthy();
      expect(a.action, `${stage} produced no action`).toBeTruthy();
      expect(typeof a.because, `${stage} gave no reason`).toBe("string");
      expect(a.because.length, `${stage} gave an empty reason`).toBeGreaterThan(0);
    }
  });

  it("never claims someone is waiting when nothing is owed", () => {
    for (const stage of ["withdrawn", "not_moving_forward"]) {
      const a = deriveNextAction(facts({ stage }));
      expect(a.waiting_since, `${stage} still reported a wait`).toBeNull();
    }
  });
});

describe("a dealbreaker cap is an outcome, not a fault", () => {
  // RT 1ecaf69b sat in manual_review_required with a banner reading
  // "Disqualified by screening answer · The assessment itself completed",
  // while the Next step card offered "Repair processing" for a pipeline that
  // was not broken. manual_review_required carries two meanings — "a human
  // must look" and "processing broke" — and the repair branch only knows the
  // second (audit 1 Sep, F13).
  it("offers the screening answer, not a repair, for a capped candidate", () => {
    const a = deriveNextAction(
      facts({ processing_state: "manual_review_required", disqualified_by_screening: true }),
    );
    expect(a.step).toBe("review_disqualification");
    expect(a.action_label).toBe("Review the answer");
  });

  it("still offers repair when processing genuinely broke", () => {
    const a = deriveNextAction(
      facts({ processing_state: "manual_review_required", disqualified_by_screening: false }),
    );
    expect(a.step).toBe("repair_processing");
  });

  it("does not claim a repair is needed for any capped state", () => {
    for (const state of ["failed", "provider_blocked", "manual_review_required", "ocr_required"]) {
      const a = deriveNextAction(
        facts({ processing_state: state, disqualified_by_screening: true }),
      );
      expect(a.step, state).toBe("review_disqualification");
    }
  });
});
