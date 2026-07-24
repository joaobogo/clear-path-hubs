import { describe, expect, it } from "vitest";
import { classifyScoreBand, displayScore } from "@/config/scoring-bands";

describe("classifyScoreBand", () => {
  it("is stable at boundaries", () => {
    expect(classifyScoreBand(95).key).toBe("exceptional");
    expect(classifyScoreBand(94).key).toBe("top");
    expect(classifyScoreBand(85).key).toBe("top");
    expect(classifyScoreBand(84).key).toBe("strong");
    expect(classifyScoreBand(70).key).toBe("strong");
    expect(classifyScoreBand(69).key).toBe("consider");
    expect(classifyScoreBand(50).key).toBe("consider");
    expect(classifyScoreBand(49).key).toBe("not_recommended");
    expect(classifyScoreBand(0).key).toBe("not_recommended");
  });

  it("87 is Top Fit — never Consider", () => {
    expect(classifyScoreBand(87).key).toBe("top");
    expect(classifyScoreBand(87).label).toBe("Top Fit");
  });

  it("null / NaN / undefined -> unscored", () => {
    expect(classifyScoreBand(null).key).toBe("unscored");
    expect(classifyScoreBand(undefined).key).toBe("unscored");
    expect(classifyScoreBand(NaN).key).toBe("unscored");
  });

  it("clamps to 0..100", () => {
    expect(classifyScoreBand(150).key).toBe("exceptional");
    expect(classifyScoreBand(-10).key).toBe("not_recommended");
  });
});

describe("displayScore", () => {
  it("rounds to whole numbers, never fabricates precision", () => {
    expect(displayScore(87.4)).toBe(87);
    expect(displayScore(87.6)).toBe(88);
    expect(displayScore(null)).toBeNull();
    expect(displayScore(NaN)).toBeNull();
  });
});
