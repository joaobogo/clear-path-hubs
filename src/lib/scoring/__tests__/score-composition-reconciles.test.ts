import { describe, expect, it } from "vitest";
import { buildScoreComposition } from "../score-composition";

const weights = { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 };

function compose(mh: number, pr: number, sa: number, published: number, videoBonusPts = 0) {
  return buildScoreComposition({
    coverage: { must_have: mh, preferred: pr, screening_alignment: sa, category_weights: weights },
    result: null,
    displayedScore: published,
    videoBonusPts,
  })!;
}

describe("score composition reconciles with the headline", () => {
  const cases: Array<[string, number, number, number, number]> = [
    ["Helena-like", 1, 0.875, 1, 97.5],
    ["Filipe-like", 1, 0.625, 1, 92.5],
    ["mid band", 0.75, 0.5, 0.6, 67],
    ["human adjusted upward", 0.8, 0.4, 0.5, 71],
  ];

  for (const [name, mh, pr, sa, published] of cases) {
    it(`${name}: parts add up to the published score`, () => {
      const c = compose(mh, pr, sa, published);
      const sum = c.components.reduce((n, k) => n + k.displayPts, 0) + c.videoBonusPts;
      expect(sum).toBe(c.grandTotalPts);
      expect(c.grandTotalPts).toBe(Math.round(published));
      expect(c.reconciles).toBe(true);
    });
  }

  it("adds the video bonus as its own line and still reconciles", () => {
    const c = compose(1, 0.875, 1, 107.5, 10);
    const sum = c.components.reduce((n, k) => n + k.displayPts, 0) + c.videoBonusPts;
    expect(c.videoBonusPts).toBe(10);
    expect(sum).toBe(c.grandTotalPts);
    expect(c.grandTotalPts).toBe(108);
  });
});
