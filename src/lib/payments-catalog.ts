/**
 * What a client is buying — the single source of truth for everything sold.
 *
 * Every amount comes from `positionsTotalUsd()` in src/config/pricing-core.ts,
 * so the catalogue can never disagree with the price on the page. The price
 * actually charged is still resolved server-side from the payment provider by
 * `priceId`; nothing the browser sends about price is trusted.
 *
 * Price identifiers are named after the position count they cover
 * (`oneoff_pos_5`, `sub_pos_5_monthly`), because the amount is a pure function
 * of that count. Identifiers from the previous, deleted price model are gone.
 */
import {
  positionsTotalUsd,
  formatUsdExact,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

/** Position counts we publish as buyable offers. Any count 1–30 is priced by the rule. */
export const CATALOGUE_POSITION_COUNTS = [1, 5, 10, 20, 30] as const;

export const POSITION_PUBLISH_PRICE_ID = "oneoff_pos_1";

export const POSITION_PUBLISH_OFFER = {
  priceId: POSITION_PUBLISH_PRICE_ID,
  name: "Pilot — 1 active role",
  amountUsd: positionsTotalUsd(1)!,
  display: formatUsdExact(positionsTotalUsd(1)!),
  turnaround: TURNAROUND_LABEL,
  includes: [
    "One active role published to the job board and our sourcing network",
    "Sourcing, outreach and application handling by our team",
    "Evidence-backed shortlist in your workspace — no CV dumps",
    "Full ATS: pipeline, interviews, scorecards and offers",
  ],
  nextSteps: [
    "Your role goes live the moment payment clears — no extra step from you.",
    "We confirm the brief and start sourcing the same working day.",
    "First shortlisted candidates land in your workspace within 5 working days.",
  ],
} as const;

/** How many roles a purchase entitles the client to publish. */
export type PlanOffer = {
  priceId: string;
  productId: string;
  label: string;
  kind: "package" | "subscription";
  interval?: "month" | "year";
  amountUsd: number;
  /** null means unlimited active roles while the plan is live. */
  rolesTotal: number | null;
  /** Packages expire; subscriptions run until cancelled. */
  validForDays: number | null;
  /** Rank for upgrade/downgrade comparison. Higher = bigger plan. */
  tier: number;
  summary: string;
};

const ANNUAL_MULTIPLIER = 12 * 0.9; // 10% off on an annual commit

function positionsLabel(n: number): string {
  return n === 1 ? "1 position" : `${n} positions`;
}

function buildCatalogue(): PlanOffer[] {
  const offers: PlanOffer[] = [];
  CATALOGUE_POSITION_COUNTS.forEach((n, index) => {
    const total = positionsTotalUsd(n)!;
    const label = n === 1 ? "Pilot — 1 position" : positionsLabel(n);
    offers.push({
      priceId: `oneoff_pos_${n}`,
      productId: `oneoff_pos_${n}`,
      label,
      kind: "package",
      amountUsd: total,
      rolesTotal: n,
      validForDays: n === 1 ? 90 : 180,
      tier: index + 1,
      summary:
        n === 1
          ? `One active role for ${formatUsdExact(total)}, ${TURNAROUND_LABEL}.`
          : `${positionsLabel(n)} for ${formatUsdExact(total)} in total.`,
    });
  });

  CATALOGUE_POSITION_COUNTS.forEach((n, index) => {
    const total = positionsTotalUsd(n)!;
    offers.push({
      priceId: `sub_pos_${n}_monthly`,
      productId: `sub_pos_${n}`,
      label: `${positionsLabel(n)} — monthly`,
      kind: "subscription",
      interval: "month",
      amountUsd: total,
      rolesTotal: n,
      validForDays: null,
      tier: 10 + index + 1,
      summary: `${positionsLabel(n)} at a time for ${formatUsdExact(total)} a month.`,
    });
    offers.push({
      priceId: `sub_pos_${n}_yearly`,
      productId: `sub_pos_${n}`,
      label: `${positionsLabel(n)} — annual`,
      kind: "subscription",
      interval: "year",
      amountUsd: Math.round(total * ANNUAL_MULTIPLIER),
      rolesTotal: n,
      validForDays: null,
      tier: 10 + index + 1,
      summary: `${positionsLabel(n)} on an annual commit — 10% off.`,
    });
  });

  return offers;
}

export const PLAN_CATALOGUE: readonly PlanOffer[] = buildCatalogue();

export function findPlan(priceId: string): PlanOffer | undefined {
  return PLAN_CATALOGUE.find((p) => p.priceId === priceId);
}

export function isSubscriptionPrice(priceId: string): boolean {
  return findPlan(priceId)?.kind === "subscription";
}

/** Human sentence for an allowance — used in receipts and workspace copy. */
export function allowanceSentence(plan: PlanOffer): string {
  if (plan.rolesTotal === null) return "Unlimited active roles while the plan runs.";
  if (plan.kind === "subscription") {
    return `Up to ${plan.rolesTotal} active roles at a time.`;
  }
  return plan.rolesTotal === 1
    ? "One role, published when you're ready."
    : `${plan.rolesTotal} roles, published whenever you need them.`;
}

/** Expiry for a package allowance, or null for subscriptions. */
export function entitlementExpiry(plan: PlanOffer, from = new Date()): string | null {
  if (plan.validForDays === null) return null;
  const d = new Date(from);
  d.setDate(d.getDate() + plan.validForDays);
  return d.toISOString();
}
