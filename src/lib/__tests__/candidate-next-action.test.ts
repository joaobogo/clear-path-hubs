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
