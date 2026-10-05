// Package-card display shape for public pricing surfaces.
// Every number comes from src/config/pricing-core.ts — the single source of
// truth. We sell packages: one capacity, one total. Never publish a
// per-position figure, never describe a package as a range between two counts,
// and never precede a price with "From".
//
// Consumed by: /pricing, ROI calculator, homepage cost band, agency comparator.

import {
  PILOT_PACKAGE,
  PACKAGE_10,
  PACKAGE_20,
  PACKAGE_30,
  PACKAGE_40,
  PACKAGE_100,
  PILOT_ROLES_LABEL,
  ABOVE_MAX_DISPLAY,
  ABOVE_MAX_ROLES_LABEL,
  ABOVE_MAX_CTA_LABEL,
  ROI_REFERENCE_PACKAGE_USD,
  ROI_REFERENCE_PACKAGE_LABEL as CORE_ROI_LABEL,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

export type PricingTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "portfolio" | "program" | "enterprise";
  name: string;
  eyebrow: string;
  /** The one exact total in USD for this package. Null above the maximum. */
  oneTime: number | null;
  /** Display string — the exact package total, or the talk-to-us label. */
  priceDisplay: string;
  /** Billing line (e.g. "billed once"). Never a per-position figure. */
  pricePer?: string;
  /** Best-fit descriptor. */
  bestFor: string;
  /** Capacity sentence — always "up to" and a single number. */
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
  "Activate position credits when you need them",
  "Ranked shortlist per position",
  "Evidence-backed scoring with fit notes",
  "Criteria-based ethical ranking",
  "3 months candidate-record retention",
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "pilot",
    name: "Pilot",
    eyebrow: `One-time · ${PILOT_ROLES_LABEL} · 1 per company`,
    oneTime: PILOT_PACKAGE.totalUsd,
    priceDisplay: PILOT_PACKAGE.totalDisplay,
    pricePer: "billed once",
    bestFor: "Test the model on one critical hire, once.",
    rolesIncluded: PILOT_ROLES_LABEL,
    turnaround: TURNAROUND_LABEL,
    included: BASE_INCLUDED,
    ctaLabel: "Start your first role — $699",
    ctaTo: "/intake",
  },
  {
    id: "growth",
    name: PACKAGE_10.capacityLabel,
    eyebrow: PACKAGE_10.capacityLabel,
    oneTime: PACKAGE_10.totalUsd,
    priceDisplay: PACKAGE_10.totalDisplay,
    pricePer: "billed once",
    bestFor: "Prepay up to 10 position credits and activate them whenever you need them.",
    rolesIncluded: PACKAGE_10.capacityLabel,
    turnaround: TURNAROUND_LABEL,
    included: PARALLEL_INCLUDED,
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
    highlight: true,
  },
  {
    id: "scale",
    name: PACKAGE_20.capacityLabel,
    eyebrow: PACKAGE_20.capacityLabel,
    oneTime: PACKAGE_20.totalUsd,
    priceDisplay: PACKAGE_20.totalDisplay,
    pricePer: "billed once",
    bestFor: "Prepay up to 20 position credits. Use them across the year as hiring needs appear.",
    rolesIncluded: PACKAGE_20.capacityLabel,
    turnaround: TURNAROUND_LABEL,
    included: [...PARALLEL_INCLUDED, "Priority support"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "volume",
    name: PACKAGE_30.capacityLabel,
    eyebrow: PACKAGE_30.capacityLabel,
    oneTime: PACKAGE_30.totalUsd,
    priceDisplay: PACKAGE_30.totalDisplay,
    pricePer: "billed once",
    bestFor: "Prepay up to 30 position credits for hiring across teams and business units.",
    rolesIncluded: PACKAGE_30.capacityLabel,
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
    id: "portfolio",
    name: PACKAGE_40.capacityLabel,
    eyebrow: PACKAGE_40.capacityLabel,
    oneTime: PACKAGE_40.totalUsd,
    priceDisplay: PACKAGE_40.totalDisplay,
    pricePer: "billed once",
    bestFor: "Prepay up to 40 position credits and draw them down as roles open.",
    rolesIncluded: PACKAGE_40.capacityLabel,
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
    id: "program",
    name: PACKAGE_100.capacityLabel,
    eyebrow: PACKAGE_100.capacityLabel,
    oneTime: PACKAGE_100.totalUsd,
    priceDisplay: PACKAGE_100.totalDisplay,
    pricePer: "billed once",
    bestFor: "Prepay up to 100 position credits for a large hiring programme; unused credits can roll over.",
    rolesIncluded: PACKAGE_100.capacityLabel,
    turnaround: TURNAROUND_LABEL,
    included: [
      ...PARALLEL_INCLUDED,
      "Priority support",
      "Dedicated account manager",
      "Executive portfolio dashboard",
      "Named executive sponsor",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "enterprise",
    name: ABOVE_MAX_ROLES_LABEL,
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    oneTime: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    bestFor:
      "Continuous hiring across business units, geographies, or 50–5,000-employee operators.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    turnaround: "Custom system operating cadence",
    included: [
      `Everything in ${PACKAGE_100.capacityLabel}`,
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
 * Guarantees shown under the pricing packages.
 */
export const PRICING_GUARANTEES: string[] = [
  "No hidden fees",
  "You keep all candidates",
  "Choose prepaid credits or continuous subscription",
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

/** Reference package price used by the ROI calculator. */
export const ROI_REFERENCE_PACKAGE = ROI_REFERENCE_PACKAGE_USD;
export const ROI_REFERENCE_PACKAGE_LABEL = CORE_ROI_LABEL;

export function formatPrice(tier: PricingTier): string {
  return tier.priceDisplay;
}
