import { describe, it, expect } from "vitest";
import { buildDistribution, type StoryCandidate } from "../client/role-story";
import { classifyBand } from "../../lib/scoring/bands";

describe("buildDistribution", () => {
  it("should correctly bucket candidates and sum up to total delivered", () => {
    const candidates: StoryCandidate[] = [
      { match_id: "1", name: "Beatriz", stage: "delivered", score: 88, requirement_rows: [] },
      { match_id: "2", name: "Ana", stage: "delivered", score: 79, requirement_rows: [] },
      { match_id: "3", name: "Inês", stage: "delivered", score: 73, requirement_rows: [] },
      { match_id: "4", name: "Carla", stage: "delivered", score: 66, requirement_rows: [] },
      { match_id: "5", name: "Sofia", stage: "delivered", score: 63, requirement_rows: [] },
      { match_id: "6", name: "Tiago", stage: "delivered", score: 58, requirement_rows: [] },
      { match_id: "7", name: "Miguel", stage: "delivered", score: 54, requirement_rows: [] },
      { match_id: "8", name: "Rui", stage: "delivered", score: 47, requirement_rows: [] },
      { match_id: "9", name: "Diogo", stage: "delivered", score: 44, requirement_rows: [] },
      { match_id: "10", name: "Pedro", stage: "delivered", score: 41, requirement_rows: [] },
    ];

    // NOTE: We expect the "Honesty Gate" to be active in the real code,
    // so this test might fail if it's currently hardcoded to 0.
    // However, the task is to fix the logic while acknowledging the gate.
    
    const dist = buildDistribution(candidates);
    const totalCount = dist.bands.reduce((sum, b) => sum + b.count, 0);
    
    // The bug report says "Actual Not Recommended 0–49 population is 3".
    // If we find that totalCount is 7, we've reproduced the bug.
    expect(totalCount).toBe(candidates.length);
  });
});
