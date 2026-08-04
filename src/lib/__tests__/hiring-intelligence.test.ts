import { describe, expect, it } from "vitest";
import { resolveMetricStatus, compare, bucketScores, isStale, median } from "@/lib/intelligence/hiring-intelligence";

const now = new Date("2026-08-04T00:00:00Z");

describe("metric states", () => {
  it("reports no_data when nothing was counted", () => {
    expect(resolveMetricStatus({ counted: 0, now }).status).toBe("no_data");
  });
  it("reports insufficient below the minimum sample", () => {
    expect(resolveMetricStatus({ counted: 2, minSample: 3, now }).status).toBe("insufficient");
  });
  it("reports stale when the newest record is old", () => {
    expect(resolveMetricStatus({ counted: 9, latestAt: "2026-06-01T00:00:00Z", now }).status).toBe("stale");
  });
  it("reports partial when fewer records than expected are measurable", () => {
    expect(resolveMetricStatus({ counted: 3, expected: 8, latestAt: now.toISOString(), now }).status).toBe("partial");
  });
  it("reports error first", () => {
    expect(resolveMetricStatus({ counted: 0, error: "boom", now }).status).toBe("error");
  });
  it("reports ok only when complete and fresh", () => {
    expect(resolveMetricStatus({ counted: 8, expected: 8, latestAt: now.toISOString(), now }).status).toBe("ok");
  });
});

describe("comparison never invents a baseline", () => {
  it("returns unknown without a baseline", () => {
    expect(compare(4, null).direction).toBe("unknown");
    expect(compare(4, null).delta).toBeNull();
  });
  it("treats a fall as good when lower is better", () => {
    expect(compare(4, 6, { lowerIsBetter: true }).tone).toBe("good");
  });
});

describe("distribution and helpers", () => {
  it("counts scores into canonical bands without smoothing", () => {
    const points = bucketScores([96, 88, 88, 40]);
    expect(points.find((p) => p.key === "exceptional")?.value).toBe(1);
    expect(points.find((p) => p.key === "top")?.value).toBe(2);
    expect(points.reduce((s, p) => s + p.value, 0)).toBe(4);
  });
  it("median of an empty set is null, never zero", () => {
    expect(median([])).toBeNull();
  });
  it("no latest record is not stale", () => {
    expect(isStale(null, 7, now)).toBe(false);
  });
});
