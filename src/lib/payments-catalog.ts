/**
 * What a client is buying — the single source of truth for everything sold.
 *
 * Every amount comes from `positionsTotalUsd()` in src/config/pricing-core.ts,
 * so the catalogue can never disagree with the price on the page. The price
 * actually charged is still resolved server-side from the payment provider by
 * `priceId`; nothing the browser sends about price is trusted.
 *
 * We sell packages, not positions. Price identifiers are named after the
 * package capacity they cover (`oneoff_pkg_10`, `sub_pkg_10_monthly`), because
 * the amount is a pure function of the package. Identifiers from the previous,
 * deleted per-position price model are gone.
 * There is no annual price: a second, lower total would contradict the rule.
 */
import {
  PACKAGES,
  positionsTotalUsd,
  formatUsdExact,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

/** The published packages, in order: pilot, up to 10, up to 20, up to 30. */
export const CATALOGUE_PACKAGES = PACKAGES;

export const POSITION_PUBLISH_PRICE_ID = "oneoff_pkg_pilot";

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

function buildCatalogue(): PlanOffer[] {
  const offers: PlanOffer[] = [];

  CATALOGUE_PACKAGES.forEach((pkg, index) => {
    offers.push({
      priceId: `oneoff_pkg_${pkg.id === "pilot" ? "pilot" : pkg.capacity}`,
      productId: `oneoff_pkg_${pkg.id === "pilot" ? "pilot" : pkg.capacity}`,
      label: pkg.id === "pilot" ? "Pilot — 1 position" : pkg.capacityLabel,
      kind: "package",
      amountUsd: pkg.totalUsd,
      rolesTotal: pkg.capacity,
      validForDays: pkg.id === "pilot" ? 90 : 180,
      tier: index + 1,
      summary:
        pkg.id === "pilot"
          ? `One active role for ${pkg.totalDisplay}, ${TURNAROUND_LABEL}.`
          : `${pkg.capacityLabel} for ${pkg.totalDisplay} in total.`,
    });
  });

  CATALOGUE_PACKAGES.forEach((pkg, index) => {
    offers.push({
      priceId: `sub_pkg_${pkg.id === "pilot" ? "pilot" : pkg.capacity}_monthly`,
      productId: `sub_pkg_${pkg.id === "pilot" ? "pilot" : pkg.capacity}`,
      label: `${pkg.id === "pilot" ? "1 position" : pkg.capacityLabel} — monthly`,
      kind: "subscription",
      interval: "month",
      amountUsd: pkg.totalUsd,
      rolesTotal: pkg.capacity,
      validForDays: null,
      tier: 10 + index + 1,
      summary: `${pkg.capacityLabel} each month for ${pkg.totalDisplay} a month.`,
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
  if (plan.rolesTotal === null) return "Capacity agreed with you.";
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
