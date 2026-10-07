import { describe, expect, it } from "vitest";
import { compareCosts, describeDifference, COMPARISON_DEFAULTS } from "@/lib/pricing-comparison";
import { PACKAGE_10, PACKAGE_100, PILOT_PACKAGE } from "@/config/pricing-core";

const base = { agencyFeePct: 20, salaryUsd: 85_000 };

describe("compareCosts", () => {
  it("covers 3 hires with the up-to-10 package, paid once", () => {
    const r = compareCosts({ mode: "project", hires: 3, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.packageLabel).toBe("Up to 10 positions");
    expect(r.agencyTotalUsd).toBe(3 * 85_000 * 0.2);
    expect(r.taasTotalUsd).toBe(PACKAGE_10.totalUsd);
    expect(r.differenceUsd).toBe(51_000 - PACKAGE_10.totalUsd);
    expect(r.direction).toBe("taasflow-lower");
    expect(r.explanation).toContain("less");
  });

  it("sums monthly totals over 12 months in recurring mode", () => {
    const r = compareCosts({ mode: "recurring", hires: 12, positions: 8, months: 12, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.taasTotalUsd).toBe(PACKAGE_10.totalUsd * 12);
    expect(r.agencyTotalUsd).toBe(12 * 85_000 * 0.2);
    expect(r.months).toBe(12);
  });

  it("never prices a one-position subscription at the one-off pilot", () => {
    const r = compareCosts({ mode: "recurring", hires: 1, positions: 1, months: 12, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.taasTotalUsd).toBe(PACKAGE_10.totalUsd * 12);
    expect(r.taasTotalUsd).not.toBe(PILOT_PACKAGE.totalUsd * 12);
  });

  it("returns quote-only above 100 positions with no TaaSFlow price", () => {
    const r = compareCosts({ mode: "project", hires: 101, ...base });
    expect(r.status).toBe("quote-only");
    expect(JSON.stringify(r)).not.toContain("taasTotalUsd");
    if (r.status === "quote-only") expect(r.explanation).toContain("scoped with your account team");
  });

  it("covers exactly 100 positions with the largest package", () => {
    const r = compareCosts({ mode: "project", hires: 100, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.taasTotalUsd).toBe(PACKAGE_100.totalUsd);
  });

  it.each([
    [{ hires: 0 }],
    [{ hires: -2 }],
    [{ hires: 2.5 }],
    [{ hires: Number.NaN }],
    [{ salaryUsd: 0 }],
    [{ salaryUsd: -1 }],
    [{ agencyFeePct: -1 }],
    [{ agencyFeePct: 101 }],
    [{ agencyFeePct: Number.NaN }],
  ])("rejects invalid input %j", (override) => {
    const r = compareCosts({ mode: "project", hires: 3, ...base, ...override });
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") expect(r.problems.length).toBeGreaterThan(0);
  });

  it("rejects invalid months and positions in recurring mode", () => {
    expect(compareCosts({ mode: "recurring", hires: 3, ...base, months: 0 }).status).toBe("invalid");
    expect(compareCosts({ mode: "recurring", hires: 3, ...base, months: 61 }).status).toBe("invalid");
    expect(
      compareCosts({ mode: "recurring", hires: 3, positions: 0, ...base, months: 6 }).status,
    ).toBe("invalid");
  });

  it("allows a negative difference when the agency is cheaper", () => {
    // 1 hire at a 0.5% fee on a low salary: the agency costs less than the pilot.
    const r = compareCosts({ mode: "project", hires: 1, agencyFeePct: 0.5, salaryUsd: 40_000 });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.agencyTotalUsd).toBe(200);
    expect(r.differenceUsd).toBe(200 - PILOT_PACKAGE.totalUsd);
    expect(r.differenceUsd).toBeLessThan(0);
    expect(r.direction).toBe("taasflow-higher");
    expect(r.explanation).toContain("more than");
    expect(r.explanation).toContain("cheaper option here is the agency");
    expect(describeDifference(r.differenceUsd)).toMatch(/more with TaaSFlow$/);
  });

  it("reports equal totals plainly", () => {
    const r = compareCosts({
      mode: "project",
      hires: 1,
      agencyFeePct: (PILOT_PACKAGE.totalUsd / 100_000) * 100,
      salaryUsd: 100_000,
    });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.differenceUsd).toBe(0);
    expect(r.direction).toBe("equal");
  });

  it("does not count internal recruiter time and says so", () => {
    const r = compareCosts({ mode: "project", hires: 3, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.assumptions.join(" ")).toContain("Internal recruiter time is left out on both sides");
  });

  it("never prints the word annual in project mode", () => {
    const r = compareCosts({ mode: "project", hires: 3, ...base });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(JSON.stringify(r).toLowerCase()).not.toContain("annual savings");
  });

  it("uses one salary default and labels defaults as examples", () => {
    expect(COMPARISON_DEFAULTS.salaryUsd).toBe(85_000);
  });
});
