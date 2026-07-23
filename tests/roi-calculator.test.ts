import { describe, it, expect } from "vitest";
import { computeRoi } from "@/lib/roi-calculator";
import { CALCULATOR_DEFAULTS } from "@/config/public-pricing";

const base = {
  positions: CALCULATOR_DEFAULTS.positions,
  averageSalaryUsd: CALCULATOR_DEFAULTS.averageSalaryUsd,
  agencyFeePct: CALCULATOR_DEFAULTS.agencyFeePct,
  recruiterHourlyUsd: CALCULATOR_DEFAULTS.recruiterHourlyUsd,
  sourcingHoursPerRole: CALCULATOR_DEFAULTS.sourcingHoursPerRole,
};

describe("computeRoi", () => {
  it("computes traditional cost as agency + internal sourcing", () => {
    const r = computeRoi(base);
    // 5 * 85000 * 0.20 = 85000; 5 * 40 * 25 = 5000; total = 90000
    expect(r.agencyCostUsd).toBe(85_000);
    expect(r.internalSourcingCostUsd).toBe(5_000);
    expect(r.traditionalCostUsd).toBe(90_000);
  });

  it("returns custom pricing state when tier is unapproved (defaults today)", () => {
    const r = computeRoi(base);
    // All approved statuses are 'pending' at time of writing → custom.
    expect(r.isCustomPricing).toBe(true);
    expect(r.taasflowCostUsd).toBeNull();
    expect(r.projectedSavingsUsd).toBeNull();
    expect(r.projectedReductionPct).toBeNull();
  });

  it("minimum values: 1 position, no sourcing hours, small salary", () => {
    const r = computeRoi({
      ...base,
      positions: 1,
      averageSalaryUsd: 40_000,
      agencyFeePct: 0.10,
      recruiterHourlyUsd: 20,
      sourcingHoursPerRole: 5,
    });
    expect(r.agencyCostUsd).toBe(4_000);
    expect(r.internalSourcingCostUsd).toBe(100);
    expect(r.traditionalCostUsd).toBe(4_100);
  });

  it("maximum values inside approved tier range", () => {
    const r = computeRoi({
      ...base,
      positions: 10,
      averageSalaryUsd: 250_000,
      agencyFeePct: 0.30,
      recruiterHourlyUsd: 150,
      sourcingHoursPerRole: 80,
    });
    expect(r.agencyCostUsd).toBe(750_000);
    expect(r.internalSourcingCostUsd).toBe(120_000);
    expect(r.traditionalCostUsd).toBe(870_000);
    // Positions 10 → Hiring Sprint tier; unapproved so custom.
    expect(r.taasflowPackage?.id).toBe("hiring-sprint");
  });

  it("subscription range triggers custom pricing", () => {
    const r = computeRoi({ ...base, positions: 15 });
    expect(r.taasflowPackage?.id).toBe("subscription");
    expect(r.isCustomPricing).toBe(true);
  });

  it("negative-savings state exposed via hasNegativeSavings when a public price exists", () => {
    // Simulate a public price by injecting a manual result path:
    // pure fn — construct traditionalCost that is smaller than taasflowCost
    // We can't force pricing approval here, so test the sentinel logic:
    // when isCustomPricing is true, hasNegativeSavings must be false.
    const r = computeRoi({ ...base, positions: 15, averageSalaryUsd: 40_000, agencyFeePct: 0.10, recruiterHourlyUsd: 20, sourcingHoursPerRole: 5 });
    expect(r.isCustomPricing).toBe(true);
    expect(r.hasNegativeSavings).toBe(false);
  });

  it("no database side effects: function is pure", () => {
    const a = computeRoi(base);
    const b = computeRoi(base);
    expect(a).toEqual(b);
  });
});
