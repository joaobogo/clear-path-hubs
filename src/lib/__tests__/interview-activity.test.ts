import { describe, expect, it } from "vitest";
import {
  distinctInterviewMatches,
  mergeInterviewActivity,
} from "@/lib/kpis/interview-activity";

describe("interview activity (legacy rows + interview-stage entries)", () => {
  const at = "2026-08-05T10:00:00Z";

  it("counts a match that reached the interview stage even with no interview row", () => {
    const rows = mergeInterviewActivity([], [{ candidate_match_id: "m1", at }]);
    expect(distinctInterviewMatches(rows)).toBe(1);
  });

  it("counts legacy completed rows and new stage entries together, once per match", () => {
    const legacy = [{ id: "i1", candidate_match_id: "m1", status: "completed" }];
    const rows = mergeInterviewActivity(legacy, [
      { candidate_match_id: "m1", at },
      { candidate_match_id: "m2", at },
      { candidate_match_id: "m2", at: "2026-08-06T10:00:00Z" },
    ]);
    expect(distinctInterviewMatches(rows)).toBe(2);
    expect(rows.filter((r) => r["candidate_match_id"] === "m2")).toHaveLength(1);
  });

  it("is zero, not NaN, with nothing and ignores blank match ids", () => {
    expect(distinctInterviewMatches(mergeInterviewActivity([], []))).toBe(0);
    expect(distinctInterviewMatches(mergeInterviewActivity([], [{ candidate_match_id: "", at }]))).toBe(0);
  });

  it("keeps the earliest stage entry", () => {
    const rows = mergeInterviewActivity([], [
      { candidate_match_id: "m1", at: "2026-08-06T10:00:00Z" },
      { candidate_match_id: "m1", at },
    ]);
    expect(rows[0]!["entered_at"]).toBe(at);
  });
});
