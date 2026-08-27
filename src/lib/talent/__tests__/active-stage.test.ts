import { describe, expect, it } from "vitest";
import { excludeStillInPlay, pairKey } from "@/lib/talent/active-stage";

const memory = (over: Partial<Parameters<typeof excludeStillInPlay>[0][number]> = {}) => ({
  candidate_profile_id: "cand-1",
  source_position_id: "pos-1",
  reason_category: "better_fit_selected" as string | null,
  ...over,
});

const livePair = new Set([pairKey("cand-1", "pos-1")]);

describe("excludeStillInPlay", () => {
  it("hides a passed-over memory while the candidate is live on that same role", () => {
    expect(excludeStillInPlay([memory()], livePair)).toEqual([]);
    expect(excludeStillInPlay([memory({ reason_category: "role_filled" })], livePair)).toEqual([]);
  });

  /**
   * The bug this guards: the filter applied to every reason, so a client who
   * added a candidate to their pool for pay or timing — while that candidate
   * was still `delivered` or `shortlisted`, which is when they are looking at
   * them — wrote the record and then saw an empty talent pool.
   */
  it("keeps candidate-side reasons visible even while the match is live", () => {
    for (const reason of ["timing", "comp_gap", "level_mismatch", "geo"]) {
      const kept = excludeStillInPlay([memory({ reason_category: reason })], livePair);
      expect(kept, `reason "${reason}" should stay visible`).toHaveLength(1);
    }
  });

  it("keeps a memory with no reason recorded", () => {
    expect(excludeStillInPlay([memory({ reason_category: null })], livePair)).toHaveLength(1);
  });

  it("keeps a passed-over memory once the candidate is no longer live on the role", () => {
    expect(excludeStillInPlay([memory()], new Set())).toHaveLength(1);
  });

  it("only matches the role the memory was recorded against", () => {
    const other = new Set([pairKey("cand-1", "pos-2")]);
    expect(excludeStillInPlay([memory()], other)).toHaveLength(1);
  });
});
