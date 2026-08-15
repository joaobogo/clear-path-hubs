/**
 * What a client is buying — the single source of truth for everything sold.
 *
 * Amounts mirror src/config/pricing-core.ts. The price actually charged is
 * always resolved server-side from the payment provider by `priceId`; nothing
 * the browser sends about price is trusted. The numbers here exist so we can
 * show honest copy before checkout, and so the webhook knows what allowance a
 * purchase grants.
 */
import {
  PRICE_PILOT_USD,
  PRICE_MULTI_USD,
  PRICE_SPRINT_USD,
  PRICE_SUB_BRONZE_USD,
  PRICE_SUB_SILVER_FROM_USD,
  PRICE_SUB_GOLD_FROM_USD,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

export const POSITION_PUBLISH_PRICE_ID = "pilot_onetime";

export const POSITION_PUBLISH_OFFER = {
  priceId: POSITION_PUBLISH_PRICE_ID,
  name: "Pilot — 1 active role",
  amountUsd: PRICE_PILOT_USD,
  display: `$${PRICE_PILOT_USD}`,
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

export const PLAN_CATALOGUE: readonly PlanOffer[] = [
  {
    priceId: POSITION_PUBLISH_PRICE_ID,
    productId: "pilot",
    label: "Pilot",
    kind: "package",
    amountUsd: PRICE_PILOT_USD,
    rolesTotal: 1,
    validForDays: 90,
    tier: 1,
    summary: "One active role, 5-day turnaround.",
  },
  {
    priceId: "multi_onetime",
    productId: "multi_position",
    label: "Multi Position",
    kind: "package",
    amountUsd: PRICE_MULTI_USD,
    rolesTotal: 5,
    validForDays: 180,
    tier: 2,
    summary: "Up to 5 active roles, used whenever you need them.",
  },
  {
    priceId: "sprint_onetime",
    productId: "sprint_package",
    label: "Sprint",
    kind: "package",
    amountUsd: PRICE_SPRINT_USD,
    rolesTotal: 10,
    validForDays: 180,
    tier: 3,
    summary: "Up to 10 active roles for a hiring push.",
  },
  {
    priceId: "sub_bronze_monthly",
    productId: "subscription_bronze",
    label: "Bronze",
    kind: "subscription",
    interval: "month",
    amountUsd: PRICE_SUB_BRONZE_USD,
    rolesTotal: 12,
    validForDays: null,
    tier: 4,
    summary: "Up to 12 active roles at a time, continuous hiring.",
  },
  {
    priceId: "sub_bronze_yearly",
    productId: "subscription_bronze",
    label: "Bronze (annual)",
    kind: "subscription",
    interval: "year",
    amountUsd: Math.round(PRICE_SUB_BRONZE_USD * 12 * 0.9),
    rolesTotal: 12,
    validForDays: null,
    tier: 4,
    summary: "Bronze on an annual commit — 10% off.",
  },
  {
    priceId: "sub_silver_monthly",
    productId: "subscription_silver",
    label: "Silver",
    kind: "subscription",
    interval: "month",
    amountUsd: PRICE_SUB_SILVER_FROM_USD,
    rolesTotal: 20,
    validForDays: null,
    tier: 5,
    summary: "Up to 20 active roles at a time.",
  },
  {
    priceId: "sub_silver_yearly",
    productId: "subscription_silver",
    label: "Silver (annual)",
    kind: "subscription",
    interval: "year",
    amountUsd: Math.round(PRICE_SUB_SILVER_FROM_USD * 12 * 0.9),
    rolesTotal: 20,
    validForDays: null,
    tier: 5,
    summary: "Silver on an annual commit — 10% off.",
  },
  {
    priceId: "sub_gold_monthly",
    productId: "subscription_gold",
    label: "Gold",
    kind: "subscription",
    interval: "month",
    amountUsd: PRICE_SUB_GOLD_FROM_USD,
    rolesTotal: null,
    validForDays: null,
    tier: 6,
    summary: "Unlimited active roles, continuous hiring.",
  },
  {
    priceId: "sub_gold_yearly",
    productId: "subscription_gold",
    label: "Gold (annual)",
    kind: "subscription",
    interval: "year",
    amountUsd: Math.round(PRICE_SUB_GOLD_FROM_USD * 12 * 0.9),
    rolesTotal: null,
    validForDays: null,
    tier: 6,
    summary: "Gold on an annual commit — 10% off.",
  },
] as const;

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
