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
} from "@/config/pricing-core";
import {
  PLAN_CATALOGUE,
  findPlan,
  CATALOGUE_POSITION_COUNTS,
} from "@/lib/payments-catalog";

const EXPECTED: Record<string, number> = Object.fromEntries(
  CATALOGUE_POSITION_COUNTS.flatMap((n) => {
    const total = positionsTotalUsd(n)!;
    return [
      [`oneoff_pos_${n}`, total],
      [`sub_pos_${n}_monthly`, total],
    ] as [string, number][];
  }),
);

describe("the pricing rule", () => {
  it("prices a single position at the flat pilot fee", () => {
    expect(positionsTotalUsd(1)).toBe(PRICE_PILOT_USD);
    expect(PRICE_PILOT_USD).toBe(699);
  });

  it("applies the band rate to every position", () => {
    expect(positionsTotalUsd(2)).toBe(1_800);
    expect(positionsTotalUsd(10)).toBe(9_000);
    expect(positionsTotalUsd(12)).toBe(10_200);
    expect(positionsTotalUsd(20)).toBe(17_000);
    expect(positionsTotalUsd(22)).toBe(17_600);
    expect(positionsTotalUsd(30)).toBe(24_000);
  });

  it("never lets the total fall as the count rises", () => {
    expect(positionsTotalUsd(21)).toBe(17_000);
    for (let n = 2; n <= MAX_POSITIONS; n += 1) {
      expect(positionsTotalUsd(n)!).toBeGreaterThanOrEqual(
        positionsTotalUsd(n - 1)!,
      );
    }
  });

  it("shows no price above the maximum", () => {
    expect(positionsTotalUsd(MAX_POSITIONS + 1)).toBeNull();
    expect(MAX_POSITIONS).toBe(30);
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
