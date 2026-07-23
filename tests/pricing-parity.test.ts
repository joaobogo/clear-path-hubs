import { describe, it, expect } from "vitest";
import {
  PRICING_PACKAGES,
  selectPackage,
  isTierPricePublic,
  formatUsdCompact,
  CALCULATOR_DEFAULTS,
} from "@/config/public-pricing";
import testCases from "../docs/migration/calculator-test-cases.json";

describe("public pricing — canonical config", () => {
  it("exposes exactly the four approved tier identifiers", () => {
    expect(PRICING_PACKAGES.map((p) => p.id)).toEqual([
      "pilot",
      "multi-position",
      "hiring-sprint",
      "subscription",
    ]);
  });

  it("tier boundaries are contiguous and inclusive", () => {
    for (let i = 1; i < PRICING_PACKAGES.length; i++) {
      const prev = PRICING_PACKAGES[i - 1];
      const cur = PRICING_PACKAGES[i];
      expect(prev.maxPositions).not.toBeNull();
      expect(cur.minPositions).toBe((prev.maxPositions ?? 0) + 1);
    }
  });

  it("no active tier has priceUsd=null while approvalStatus='approved'", () => {
    for (const p of PRICING_PACKAGES) {
      if (p.approvalStatus === "approved" && p.active && !p.customPricingOnly) {
        expect(p.priceUsd).not.toBeNull();
      }
    }
  });
});

describe("selectPackage", () => {
  it("maps position counts to the correct package (source parity)", () => {
    expect(selectPackage(1)?.id).toBe("pilot");
    expect(selectPackage(2)?.id).toBe("multi-position");
    expect(selectPackage(5)?.id).toBe("multi-position");
    expect(selectPackage(6)?.id).toBe("hiring-sprint");
    expect(selectPackage(10)?.id).toBe("hiring-sprint");
    expect(selectPackage(11)?.id).toBe("subscription");
    expect(selectPackage(500)?.id).toBe("subscription");
  });

  it("returns null below the minimum tier", () => {
    expect(selectPackage(0)).toBeNull();
    expect(selectPackage(-3)).toBeNull();
  });
});

describe("calculator ↔ pricing page ↔ config parity", () => {
  for (const c of (testCases as { cases: Array<Record<string, unknown>> }).cases) {
    const input = c.input as {
      positions: number;
      agencyFeePct: number;
      averageSalary: number;
      recruiterHourlyCost: number;
      sourcingHoursPerRole: number;
    };
    const expected = c.expected as {
      package: string | null;
      taasflowCost: number | null;
      requiresOwnerApproval?: boolean;
    };

    it(`case: ${c.id}`, () => {
      const pkg = selectPackage(input.positions);
      expect(pkg?.id ?? null).toBe(expected.package);
      if (pkg && !expected.requiresOwnerApproval) {
        expect(pkg.priceUsd).toBe(expected.taasflowCost);
      }
      if (expected.requiresOwnerApproval) {
        expect(pkg && isTierPricePublic(pkg)).toBe(false);
      }
    });
  }
});

describe("formatUsdCompact — matches source formatter", () => {
  it("K-abbreviates thousands", () => {
    expect(formatUsdCompact(85_000)).toBe("$85K");
    expect(formatUsdCompact(2_100)).toBe("$2.1K");
    expect(formatUsdCompact(87_900)).toBe("$87.9K");
    expect(formatUsdCompact(5_000)).toBe("$5K");
  });
  it("shows exact dollars below $1,000", () => {
    expect(formatUsdCompact(399)).toBe("$399");
    expect(formatUsdCompact(40)).toBe("$40");
  });
});

describe("calculator defaults", () => {
  it("defaults are within their limits", () => {
    expect(CALCULATOR_DEFAULTS.positions).toBeGreaterThanOrEqual(1);
    expect(CALCULATOR_DEFAULTS.agencyFeePct).toBeGreaterThan(0);
    expect(CALCULATOR_DEFAULTS.averageSalaryUsd).toBeGreaterThan(0);
  });
});
