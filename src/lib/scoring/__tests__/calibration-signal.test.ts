import { describe, it, expect } from "vitest";
import {
  computeCalibrationSignal,
  computeBandOccupancy,
  bucketScores,
  MIN_OUTCOMES_FOR_CONFIDENCE,
  type CalibrationRow,
} from "../calibration-signal";

function row(final_score: number, outcome: CalibrationRow["outcome"]): CalibrationRow {
  return { final_score, fit_band: null, outcome };
}

describe("computeCalibrationSignal — small sample warning", () => {
  it("flags a coverage warning when outcomes are below the confidence threshold", () => {
    const rows = [row(60, "hired"), row(45, "rejected"), row(50, "no_decision")];
    const signal = computeCalibrationSignal(rows);
    expect(signal.total_with_outcome).toBe(2);
    expect(signal.coverage_warning).toMatch(/only 2/i);
  });

  it("clears the warning once outcomes reach the confidence threshold", () => {
    const rows: CalibrationRow[] = [];
    for (let i = 0; i < MIN_OUTCOMES_FOR_CONFIDENCE; i++) {
      rows.push(row(50 + (i % 10), i % 2 === 0 ? "hired" : "rejected"));
    }
    const signal = computeCalibrationSignal(rows);
    expect(signal.total_with_outcome).toBe(MIN_OUTCOMES_FOR_CONFIDENCE);
    expect(signal.coverage_warning).toBeNull();
  });
});

describe("band occupancy", () => {
  it("reports every configured band, marking the ones never produced", () => {
    const occ = computeBandOccupancy([40, 45, 52, 60, 67]);
    const byKey = Object.fromEntries(occ.map((o) => [o.band, o]));
    expect(byKey.not_recommended.ever_produced).toBe(true);
    expect(byKey.consider.ever_produced).toBe(true);
    expect(byKey.strong.ever_produced).toBe(false);
    expect(byKey.top.ever_produced).toBe(false);
    expect(byKey.exceptional.ever_produced).toBe(false);
    expect(byKey.exceptional.produced_count).toBe(0);
  });

  it("never claims a band exists when no score falls in it", () => {
    const occ = computeBandOccupancy([]);
    for (const band of occ) {
      expect(band.ever_produced).toBe(false);
      expect(band.produced_count).toBe(0);
    }
  });
});

describe("score buckets", () => {
  it("buckets scores into fixed 10-point ranges covering 0-100", () => {
    const buckets = bucketScores([5, 42, 44, 99]);
    expect(buckets).toHaveLength(10);
    expect(buckets[0].count).toBe(1); // 0-9
    expect(buckets[4].count).toBe(2); // 40-49
    expect(buckets[9].count).toBe(1); // 90-99
  });
});

describe("discrimination verdict", () => {
  it("reports no verdict when one side of the comparison is empty", () => {
    const signal = computeCalibrationSignal([row(60, "hired"), row(55, "advanced")]);
    expect(signal.discrimination.negative_count).toBe(0);
    expect(signal.discrimination.verdict).toMatch(/not enough/i);
  });

  it("calls out a lack of separation when means are close or inverted", () => {
    const rows = [
      row(55, "hired"),
      row(56, "hired"),
      row(58, "rejected"),
      row(60, "rejected"),
    ];
    const signal = computeCalibrationSignal(rows);
    expect(signal.discrimination.gap).toBeLessThan(10);
    expect(signal.discrimination.verdict).toMatch(/do not yet separate|slight lean/i);
  });

  it("reports a meaningful separation when the gap is large", () => {
    const rows = [
      row(80, "hired"),
      row(78, "hired"),
      row(40, "rejected"),
      row(42, "rejected"),
    ];
    const signal = computeCalibrationSignal(rows);
    expect(signal.discrimination.gap).toBeGreaterThanOrEqual(10);
    expect(signal.discrimination.verdict).toMatch(/meaningful margin/i);
  });
});

describe("observed range", () => {
  it("computes min, max and median from raw scores", () => {
    const signal = computeCalibrationSignal([row(40, "no_decision"), row(60, "no_decision"), row(50, "no_decision")]);
    expect(signal.observed_min).toBe(40);
    expect(signal.observed_max).toBe(60);
    expect(signal.observed_median).toBe(50);
  });

  it("returns nulls when there are no scores at all", () => {
    const signal = computeCalibrationSignal([]);
    expect(signal.observed_min).toBeNull();
    expect(signal.observed_max).toBeNull();
    expect(signal.observed_median).toBeNull();
  });
});
