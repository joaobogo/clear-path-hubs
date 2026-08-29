import { describe, it, expect } from "vitest";
import { decideStateAfterEnrichment } from "@/lib/scoring/enrichment-state-policy";

/**
 * audit #4, L15 — "Retry enrichment" used to send a scored candidate back to
 * `ready_to_score`, re-running a five-minute assessment that returned the same
 * number and putting two states on screen at once.
 */
describe("decideStateAfterEnrichment", () => {
  it("keeps a scored candidate scored and flags the score stale", () => {
    expect(decideStateAfterEnrichment("scored")).toEqual({
      keepState: true,
      markScoreStale: true,
    });
  });

  it("advances a candidate that has no assessment yet", () => {
    for (const state of ["queued", "parsing", "parsed", "enriching", "ready_to_score"]) {
      expect(decideStateAfterEnrichment(state)).toEqual({
        keepState: false,
        nextState: "ready_to_score",
      });
    }
  });

  it("does NOT hold a match in manual review", () => {
    // This is the state an admin retries out of after fixing the cause.
    // Treating it as a completed assessment would strand the match there.
    expect(decideStateAfterEnrichment("manual_review_required")).toEqual({
      keepState: false,
      nextState: "ready_to_score",
    });
  });

  it("treats a missing state as not-yet-assessed", () => {
    expect(decideStateAfterEnrichment(null)).toEqual({
      keepState: false,
      nextState: "ready_to_score",
    });
    expect(decideStateAfterEnrichment(undefined)).toEqual({
      keepState: false,
      nextState: "ready_to_score",
    });
  });
});
