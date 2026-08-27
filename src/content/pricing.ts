// Tier-card display shape for public pricing surfaces.
// Numeric values come from src/config/pricing-core.ts — the single source of
// truth. Do NOT hard-code prices here, never render a band as a price, and
// never precede a price with "From".
//
// Consumed by: /pricing, ROI calculator, homepage cost band, agency comparator.

import {
  PRICE_PILOT_USD,
  PRICE_PILOT_DISPLAY,
  GROWTH_RATE_USD,
  SCALE_RATE_USD,
  VOLUME_RATE_USD,
  GROWTH_RATE_DISPLAY,
  SCALE_RATE_DISPLAY,
  VOLUME_RATE_DISPLAY,
  GROWTH_ROLES_LABEL,
  SCALE_ROLES_LABEL,
  VOLUME_ROLES_LABEL,
  PILOT_ROLES_LABEL,
  ABOVE_MAX_DISPLAY,
  ABOVE_MAX_ROLES_LABEL,
  ABOVE_MAX_CTA_LABEL,
  PER_POSITION_SUFFIX,
  ROI_REFERENCE_PACKAGE_USD,
  ROI_REFERENCE_PACKAGE_LABEL as CORE_ROI_LABEL,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

export type PricingTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "enterprise";
  name: string;
  eyebrow: string;
  /** Exact flat total in USD for a single-position pilot. Null for rate tiers. */
  oneTime: number | null;
  /** Per-position rate in USD for rate tiers. Null for the pilot and above 30. */
  rateUsd: number | null;
  /** Display string — an exact total ($699) or an exact rate ($900). */
  priceDisplay: string;
  /** Sub-price line (e.g. "per position"). */
  pricePer?: string;
  /** Best-fit descriptor. */
  bestFor: string;
  /** Active roles range. */
  rolesIncluded: string;
  /** Turnaround guarantee. */
  turnaround: string;
  /** Included capabilities. */
  included: string[];
  /** CTA. */
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
};

const BASE_INCLUDED = [
  "Ranked shortlist refreshed weekly",
  "Top 10 candidates per position",
  "Ranked candidate shortlist",
  "Evidence-backed scoring with fit notes",
  "Criteria-based ethical ranking",
  "3 months candidate-record retention",
];

const PARALLEL_INCLUDED = [
  "Ranked shortlist refreshed weekly",
  "Top 10 candidates per position",
  "All positions worked in parallel",
  "Ranked shortlist per position",
  "Evidence-backed scoring with fit notes",
  "Criteria-based ethical ranking",
  "3 months candidate-record retention",
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "pilot",
    name: "Pilot — Single Position",
    eyebrow: `One-time · ${PILOT_ROLES_LABEL} · 1 per company`,
    oneTime: PRICE_PILOT_USD,
    rateUsd: null,
    priceDisplay: PRICE_PILOT_DISPLAY,
    pricePer: "flat, billed once",
    bestFor: "Test the model on one critical hire, once.",
    rolesIncluded: PILOT_ROLES_LABEL,
    turnaround: TURNAROUND_LABEL,
    included: BASE_INCLUDED,
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "growth",
    name: "2 to 10 positions",
    eyebrow: GROWTH_ROLES_LABEL,
    oneTime: null,
    rateUsd: GROWTH_RATE_USD,
    priceDisplay: GROWTH_RATE_DISPLAY,
    pricePer: PER_POSITION_SUFFIX,
    bestFor: "Run parallel searches with shared intake context.",
    rolesIncluded: GROWTH_ROLES_LABEL,
    turnaround: TURNAROUND_LABEL,
    included: PARALLEL_INCLUDED,
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
    highlight: true,
  },
  {
    id: "scale",
    name: "11 to 20 positions",
    eyebrow: SCALE_ROLES_LABEL,
    oneTime: null,
    rateUsd: SCALE_RATE_USD,
    priceDisplay: SCALE_RATE_DISPLAY,
    pricePer: PER_POSITION_SUFFIX,
    bestFor: "Concurrent hiring across functions with priority support.",
    rolesIncluded: SCALE_ROLES_LABEL,
    turnaround: TURNAROUND_LABEL,
    included: [...PARALLEL_INCLUDED, "Priority support"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "volume",
    name: "21 to 30 positions",
    eyebrow: VOLUME_ROLES_LABEL,
    oneTime: null,
    rateUsd: VOLUME_RATE_USD,
    priceDisplay: VOLUME_RATE_DISPLAY,
    pricePer: PER_POSITION_SUFFIX,
    bestFor: "Portfolio hiring across teams at the lowest published rate.",
    rolesIncluded: VOLUME_ROLES_LABEL,
    turnaround: TURNAROUND_LABEL,
    included: [
      ...PARALLEL_INCLUDED,
      "Priority support",
      "Dedicated account manager",
      "Executive portfolio dashboard",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "enterprise",
    name: "More than 30 positions",
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    oneTime: null,
    rateUsd: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    bestFor:
      "Continuous hiring across business units, geographies, or 50–5,000-employee operators.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    turnaround: "Custom system operating cadence",
    included: [
      "Everything in 21 to 30 positions",
      "Dedicated account structure",
      "Tailored billing and reporting",
      "SLA-backed delivery",
      "SSO, custom data residency, security review",
      "Named executive sponsor",
    ],
    ctaLabel: ABOVE_MAX_CTA_LABEL,
    ctaTo: "/enterprise",
  },
];

/**
 * Guarantees shown under the pricing tiers.
 */
export const PRICING_GUARANTEES: string[] = [
  "No hidden fees",
  "You keep all candidates",
  "Run a pilot before you subscribe",
];

/**
 * "What you will never see on a TaaSFlow invoice."
 */
export const NEVER_CHARGED: string[] = [
  "Placement fees",
  "Salary-percentage commissions",
  "Per-CV pass-through charges",
  "Hidden markups on interviews or offers",
];

/** Reference basket price used by the ROI calculator. */
export const ROI_REFERENCE_PACKAGE = ROI_REFERENCE_PACKAGE_USD;
export const ROI_REFERENCE_PACKAGE_LABEL = CORE_ROI_LABEL;

export function formatPrice(tier: PricingTier): string {
  return tier.priceDisplay;
}
