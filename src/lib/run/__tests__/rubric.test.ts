import { describe, expect, it } from "vitest";
import { rebalance, weightedScore } from "@/lib/run/rubric";
import { SAMPLE_RUBRIC_WEIGHTS, SAMPLE_SHORTLIST, SAMPLE_SHORTLIST_REQUIREMENTS } from "@/lib/previews/representative-fixtures";

describe("rubric weights", () => {
  it("start at 100 in the example brief", () => {
    expect(Object.values(SAMPLE_RUBRIC_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("always total 100 after a drag, with the chips untouched", () => {
    const fixed = 25;
    let sliders = [35, 25, 15];
    for (const [i, v] of [
      [0, 60],
      [1, 0],
      [2, 75],
      [0, 10],
      [1, 33],
    ] as const) {
      sliders = rebalance(sliders, i, v, fixed);
      expect(sliders.reduce((a, b) => a + b, 0) + fixed).toBe(100);
      expect(sliders[i]).toBe(Math.min(v, 100 - fixed));
      for (const w of sliders) expect(Number.isInteger(w) && w >= 0).toBe(true);
    }
  });

  it("clamps to what the chips leave", () => {
    expect(rebalance([35, 25, 15], 0, 999, 25)).toEqual([75, 0, 0]);
    expect(rebalance([35, 25, 15], 0, -5, 25)).toEqual([0, 47, 28]);
  });

  it("scores the top example candidate from the same weights the chapter shows", () => {
    const c = SAMPLE_SHORTLIST[0]!;
    const scores = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => c.results[q.key].score);
    const weights = SAMPLE_SHORTLIST_REQUIREMENTS.map((q) => SAMPLE_RUBRIC_WEIGHTS[q.key]);
    const s = weightedScore(scores, weights);
    expect(s).toBeGreaterThan(90);
    expect(s).toBeLessThanOrEqual(100);
    expect(weightedScore([100, 100], [50, 50])).toBe(100);
  });
});
