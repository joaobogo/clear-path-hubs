import { describe, expect, it } from "vitest";
import {
  buildStageFeedbackItems,
  matchTargetId,
  parseFeedbackTarget,
  planInterviewRecord,
} from "@/lib/interview-feedback-queue";

const m = (id: string, stage = "interview_process") => ({
  id,
  stage,
  position_id: "p1",
  position_title: "Head of Ops",
  candidate_name: `Cand ${id}`,
  entered_at: "2026-08-01T10:00:00Z",
});

describe("awaiting-feedback queue for matches at the interview stage", () => {
  it("lists a match at the interview stage with no feedback and no interview row", () => {
    const items = buildStageFeedbackItems({ matches: [m("a")], scoredMatchIds: new Set() });
    expect(items).toHaveLength(1);
    expect(items[0]!.interview_id).toBe(matchTargetId("a"));
    expect(items[0]!.candidate_name).toBe("Cand a");
  });

  it("drops matches that already have feedback, other stages, and legacy-covered matches", () => {
    const items = buildStageFeedbackItems({
      matches: [m("a"), m("b"), m("c", "shortlisted"), m("d")],
      scoredMatchIds: new Set(["a"]),
      coveredMatchIds: new Set(["d"]),
    });
    expect(items.map((i) => i.candidate_match_id)).toEqual(["b"]);
  });

  it("round-trips the synthetic target id and leaves real interview ids alone", () => {
    expect(parseFeedbackTarget(matchTargetId("abc"))).toEqual({ kind: "match", matchId: "abc" });
    expect(parseFeedbackTarget("11111111-1111-1111-1111-111111111111")).toEqual({
      kind: "interview",
      interviewId: "11111111-1111-1111-1111-111111111111",
    });
  });
});

describe("planInterviewRecord: one lightweight completed row per match", () => {
  it("creates a row when the match has none, or only cancelled ones", () => {
    expect(planInterviewRecord([])).toEqual({ kind: "create" });
    expect(planInterviewRecord([{ id: "x", status: "cancelled" }])).toEqual({ kind: "create" });
  });

  it("is idempotent: once a completed row exists a retry reuses it and advances nothing", () => {
    expect(planInterviewRecord([{ id: "x", status: "completed" }])).toEqual({
      kind: "reuse",
      id: "x",
      advance: [],
    });
  });

  it("completes legacy scheduled and open rows instead of adding a second one", () => {
    expect(planInterviewRecord([{ id: "s", status: "scheduled" }])).toEqual({
      kind: "reuse",
      id: "s",
      advance: ["completed"],
    });
    expect(planInterviewRecord([{ id: "r", status: "requested" }])).toEqual({
      kind: "reuse",
      id: "r",
      advance: ["scheduled", "completed"],
    });
  });

  it("prefers a completed row over a newer open one", () => {
    const plan = planInterviewRecord([
      { id: "old", status: "completed", created_at: "2026-01-01" },
      { id: "new", status: "requested", created_at: "2026-02-01" },
    ]);
    expect(plan).toMatchObject({ kind: "reuse", id: "old" });
  });
});
