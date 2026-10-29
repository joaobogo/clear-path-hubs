/**
 * B4: the scoring guardrail health check's flagging rules.
 */
import { describe, expect, it } from "vitest";
import { flagGuardrails, guardrailRows, type GuardrailInputs } from "@/lib/scoring/guardrail-health";

const NOW = new Date("2026-10-29T12:00:00Z");
const OLD = "2026-10-29T09:00:00Z"; // three hours ago
const RECENT = "2026-10-29T11:30:00Z"; // thirty minutes ago

function inputs(over: Partial<GuardrailInputs> = {}): GuardrailInputs {
  return {
    now: NOW,
    engineVersion: "taasflow-scoring-v1.7.1",
    matches: [],
    failedCheckMatchIds: new Set(),
    openTaskMatchIds: new Set(),
    positions: [
      { id: "p-active", title: "Group Marketing Manager", status: "active", requirements: [{ label: "SQL" }] },
      { id: "p-closed", title: "Old role", status: "closed", requirements: [{ label: "Under 35" }] },
    ],
    screeningQuestions: [],
    currentRunEngine: new Map(),
    ...over,
  };
}

const m = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  position_id: "p-active",
  eligibility_status: "eligible",
  current_score_run_id: "run",
  processing_state: "scored",
  created_at: OLD,
  ...o,
});

describe("flagGuardrails", () => {
  it("flags not_eligible matches with no failed eligibility check", () => {
    const r = flagGuardrails(
      inputs({
        matches: [m("a", { eligibility_status: "not_eligible" }), m("b", { eligibility_status: "not_eligible" }), m("c")],
        failedCheckMatchIds: new Set(["b"]),
      }),
    );
    expect(r.ineligible_without_failed_check).toEqual(["a"]);
  });

  it("flags matches unscored for over an hour, not processing, with no open task", () => {
    const r = flagGuardrails(
      inputs({
        matches: [
          m("old-unowned", { current_score_run_id: null, processing_state: "manual_review_required" }),
          m("old-owned", { current_score_run_id: null, processing_state: "failed" }),
          m("recent", { current_score_run_id: null, processing_state: "failed", created_at: RECENT }),
          m("processing", { current_score_run_id: null, processing_state: "ready_to_score" }),
          m("closed-role", { current_score_run_id: null, processing_state: "failed", position_id: "p-closed" }),
          m("scored"),
        ],
        openTaskMatchIds: new Set(["old-owned"]),
      }),
    );
    expect(r.unscored_without_task).toEqual(["old-unowned"]);
  });

  it("flags open roles whose criteria or screening questions state a protected attribute", () => {
    const r = flagGuardrails(
      inputs({
        positions: [
          { id: "p1", title: "Marketing Manager", status: "active", requirements: [{ label: "Korean nationality" }] },
          { id: "p2", title: "Sales Lead", status: "draft", requirements: [{ label: "Experience in the Korean market" }] },
          { id: "p3", title: "Analyst", status: "approved", requirements: [{ label: "SQL" }] },
          { id: "p4", title: "Closed", status: "archived", dealbreakers: [{ label: "Male candidates only" }] },
        ],
        screeningQuestions: [{ position_id: "p3", question: "What is your date of birth? Must be under 30." }],
      }),
    );
    expect(r.positions_with_protected_wording).toEqual([
      { position_id: "p1", title: "Marketing Manager", findings: 1 },
      { position_id: "p3", title: "Analyst", findings: 1 },
    ]);
  });

  it("flags current scores from an older engine on active roles only", () => {
    const r = flagGuardrails(
      inputs({
        matches: [m("old"), m("new"), m("old-on-closed", { position_id: "p-closed" }), m("unscored", { current_score_run_id: null })],
        currentRunEngine: new Map([
          ["old", "taasflow-scoring-v1.7.0"],
          ["new", "taasflow-scoring-v1.7.1"],
          ["old-on-closed", "taasflow-scoring-v1.6.0"],
        ]),
      }),
    );
    expect(r.outdated_engine_scores).toEqual(["old"]);
  });

  it("dashboard rows carry a label, a count and an action", () => {
    const rows = guardrailRows({
      ineligible_without_failed_check: ["a"],
      unscored_without_task: [],
      positions_with_protected_wording: [{ position_id: "p", title: "t", findings: 2 }],
      outdated_engine_scores: ["x", "y"],
    });
    expect(rows.map((r) => [r.key, r.count])).toEqual([
      ["ineligible_without_failed_check", 1],
      ["unscored_without_task", 0],
      ["positions_with_protected_wording", 1],
      ["outdated_engine_scores", 2],
    ]);
    expect(rows.every((r) => r.label && r.action)).toBe(true);
  });
});
