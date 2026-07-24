import { describe, expect, it } from "vitest";
import { computeDimension, computeFit } from "../fit-math";

describe("computeDimension", () => {
  it("removes N/A criteria from the denominator, not zeros them", () => {
    const r = computeDimension({
      key: "role_fit",
      weight_pct: 35,
      criteria: [
        { key: "a", score: 80 },
        { key: "b", score: null, not_applicable: true },
        { key: "c", score: 60 },
      ],
    });
    expect(r.applicable_count).toBe(2);
    expect(r.excluded_count).toBe(1);
    expect(r.score).toBe(70); // (80+60)/2
  });

  it("returns null when nothing applicable", () => {
    const r = computeDimension({
      key: "x",
      weight_pct: 10,
      criteria: [{ key: "a", score: null }, { key: "b", not_applicable: true, score: null }],
    });
    expect(r.score).toBeNull();
  });

  it("honours per-criterion weight", () => {
    const r = computeDimension({
      key: "d",
      weight_pct: 20,
      criteria: [
        { key: "a", score: 100, weight: 3 },
        { key: "b", score: 40, weight: 1 },
      ],
    });
    // (100*3 + 40*1) / 4 = 85
    expect(r.score).toBe(85);
  });
});

describe("computeFit", () => {
  it("weights dimensions by approved percentage", () => {
    const r = computeFit([
      {
        key: "role_fit",
        weight_pct: 35,
        criteria: [{ key: "a", score: 90 }],
      },
      { key: "evidence", weight_pct: 30, criteria: [{ key: "b", score: 80 }] },
      { key: "logistics", weight_pct: 20, criteria: [{ key: "c", score: 70 }] },
      { key: "signal", weight_pct: 15, criteria: [{ key: "d", score: 60 }] },
    ]);
    // 90*0.35 + 80*0.30 + 70*0.20 + 60*0.15 = 31.5+24+14+9 = 78.5
    expect(r.fit_score).toBe(78.5);
    expect(r.fit_score_display).toBe(79);
    expect(r.applied_weight).toBe(100);
  });

  it("rebases over applied weight when a dimension has no evaluable criteria", () => {
    const r = computeFit([
      { key: "a", weight_pct: 50, criteria: [{ key: "a1", score: 80 }] },
      { key: "b", weight_pct: 50, criteria: [{ key: "b1", score: null }] },
    ]);
    // Only 'a' contributes; not deflated to 40.
    expect(r.fit_score).toBe(80);
    expect(r.applied_weight).toBe(50);
  });

  it("returns null when no dimension is evaluable", () => {
    const r = computeFit([
      { key: "a", weight_pct: 100, criteria: [{ key: "a1", score: null }] },
    ]);
    expect(r.fit_score).toBeNull();
    expect(r.fit_score_display).toBeNull();
  });

  it("computes weighted evidence confidence", () => {
    const r = computeFit([
      {
        key: "a",
        weight_pct: 70,
        criteria: [{ key: "a1", score: 80, confidence: 90 }],
      },
      {
        key: "b",
        weight_pct: 30,
        criteria: [{ key: "b1", score: 60, confidence: 40 }],
      },
    ]);
    // 90*0.7 + 40*0.3 = 63 + 12 = 75
    expect(r.evidence_confidence).toBe(75);
  });

  it("reconciles: fit_score == sum(dim.score * weight_pct)/applied_weight", () => {
    const dims = [
      { key: "a", weight_pct: 40, criteria: [{ key: "a1", score: 72 }] },
      { key: "b", weight_pct: 60, criteria: [{ key: "b1", score: 88 }] },
    ];
    const r = computeFit(dims);
    const expected = (72 * 40 + 88 * 60) / 100;
    expect(r.fit_score).toBe(Math.round(expected * 10000) / 10000);
  });
});
