/**
 * Guards the checkout catalogue against pricing drift.
 *
 * Every amount a client can be charged must trace back to
 * src/config/pricing-core.ts — the single source of truth. The provider-side
 * amounts (Stripe) are verified separately against these same numbers; this
 * test stops the in-app catalogue from drifting away from the anchors.
 */
import { describe, expect, it } from "vitest";
import {
  PRICE_PILOT_USD,
  MAX_POSITIONS,
  positionsTotalUsd,
  subscriptionTotalsUsd,
  ANNUAL_DISCOUNT_PCT,
} from "@/config/pricing-core";
import {
  PLAN_CATALOGUE,
  findPlan,
  CATALOGUE_PACKAGES,
} from "@/lib/payments-catalog";

const EXPECTED: Record<string, number> = Object.fromEntries(
  CATALOGUE_PACKAGES.flatMap((pkg) => {
    const key = pkg.id === "pilot" ? "pilot" : String(pkg.capacity);
    return [
      [`oneoff_pkg_${key}`, pkg.totalUsd],
      [`sub_pkg_${key}_monthly`, pkg.totalUsd],
    ] as [string, number][];
  }),
);

describe("the pricing rule", () => {
  it("prices a single position at the flat pilot fee", () => {
    expect(positionsTotalUsd(1)).toBe(PRICE_PILOT_USD);
    expect(PRICE_PILOT_USD).toBe(699);
  });

  it("charges the covering package's one total", () => {
    expect(positionsTotalUsd(2)).toBe(8_000);
    expect(positionsTotalUsd(10)).toBe(8_000);
    expect(positionsTotalUsd(12)).toBe(15_200);
    expect(positionsTotalUsd(20)).toBe(15_200);
    expect(positionsTotalUsd(22)).toBe(21_600);
    expect(positionsTotalUsd(30)).toBe(21_600);
    expect(positionsTotalUsd(31)).toBe(27_200);
    expect(positionsTotalUsd(40)).toBe(27_200);
    expect(positionsTotalUsd(41)).toBe(32_000);
    expect(positionsTotalUsd(50)).toBe(32_000);
  });

  it("never lets the total fall as the count rises", () => {
    expect(positionsTotalUsd(21)).toBe(21_600);
    for (let n = 2; n <= MAX_POSITIONS; n += 1) {
      expect(positionsTotalUsd(n)!).toBeGreaterThanOrEqual(
        positionsTotalUsd(n - 1)!,
      );
    }
  });

  it("shows no price above the maximum", () => {
    expect(positionsTotalUsd(MAX_POSITIONS + 1)).toBeNull();
    expect(MAX_POSITIONS).toBe(50);
  });

  it("takes 10% off a twelve-month prepayment, without moving the monthly price", () => {
    const totals = subscriptionTotalsUsd(12)!;
    expect(totals.monthly).toBe(15_200);
    expect(totals.annualBeforeDiscount).toBe(15_200 * 12);
    expect(totals.annual).toBe(Math.round(15_200 * 12 * 0.9));
    expect(totals.annualSavings).toBe(15_200 * 12 - totals.annual);
    expect(ANNUAL_DISCOUNT_PCT).toBe(0.1);
    // Above the maximum there is no published price, so no annual price either.
    expect(subscriptionTotalsUsd(MAX_POSITIONS + 1)).toBeNull();
  });
});

describe("checkout catalogue pricing", () => {
  it("covers exactly the expected set of sellable prices", () => {
    expect(PLAN_CATALOGUE.map((p) => p.priceId).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(Object.entries(EXPECTED))(
    "%s is charged at the canonical anchor amount",
    (priceId, amountUsd) => {
      expect(findPlan(priceId)?.amountUsd).toBe(amountUsd);
    },
  );

  it("prices every plan above zero and in whole dollars", () => {
    for (const plan of PLAN_CATALOGUE) {
      expect(plan.amountUsd).toBeGreaterThan(0);
      expect(Number.isInteger(plan.amountUsd)).toBe(true);
    }
  });

  it("offers no annual price — a lower total would contradict the rule", () => {
    expect(PLAN_CATALOGUE.filter((p) => p.interval === "year")).toHaveLength(0);
  });

  it("uses one price id per plan and one product id per tier", () => {
    const ids = PLAN_CATALOGUE.map((p) => p.priceId);
    expect(new Set(ids).size).toBe(ids.length);

    const productToTier = new Map<string, number>();
    for (const plan of PLAN_CATALOGUE) {
      const seen = productToTier.get(plan.productId);
      if (seen !== undefined) expect(plan.tier).toBe(seen);
      productToTier.set(plan.productId, plan.tier);
    }
  });
});
