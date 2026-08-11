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
  PRICE_MULTI_USD,
  PRICE_SPRINT_USD,
  PRICE_SUB_BRONZE_USD,
  PRICE_SUB_SILVER_FROM_USD,
  PRICE_SUB_GOLD_FROM_USD,
} from "@/config/pricing-core";
import { PLAN_CATALOGUE, findPlan } from "@/lib/payments-catalog";

const annual = (monthly: number) => Math.round(monthly * 12 * 0.9);

const EXPECTED: Record<string, number> = {
  pilot_onetime: PRICE_PILOT_USD,
  multi_onetime: PRICE_MULTI_USD,
  sprint_onetime: PRICE_SPRINT_USD,
  sub_bronze_monthly: PRICE_SUB_BRONZE_USD,
  sub_bronze_yearly: annual(PRICE_SUB_BRONZE_USD),
  sub_silver_monthly: PRICE_SUB_SILVER_FROM_USD,
  sub_silver_yearly: annual(PRICE_SUB_SILVER_FROM_USD),
  sub_gold_monthly: PRICE_SUB_GOLD_FROM_USD,
  sub_gold_yearly: annual(PRICE_SUB_GOLD_FROM_USD),
};

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

  it("keeps annual commits at a 10% discount on twelve months", () => {
    for (const yearly of PLAN_CATALOGUE.filter((p) => p.interval === "year")) {
      const monthly = PLAN_CATALOGUE.find(
        (p) => p.productId === yearly.productId && p.interval === "month",
      );
      expect(monthly).toBeDefined();
      expect(yearly.amountUsd).toBe(annual(monthly!.amountUsd));
    }
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
