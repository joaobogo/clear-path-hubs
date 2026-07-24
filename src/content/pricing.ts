// Tier-card display shape for public pricing surfaces.
// Numeric values come from src/config/pricing-core.ts — the single source of
// truth. Do NOT hard-code prices here; update pricing-core.ts and every
// consumer (Pricing page, ROI calculator, homepage, agency comparator)
// updates automatically.
//
// Consumed by: /pricing, ROI calculator, homepage cost band, agency comparator.

import {
  PRICE_PILOT_USD,
  PRICE_MULTI_USD,
  PRICE_SPRINT_USD,
  PRICE_PILOT_DISPLAY,
  PRICE_MULTI_DISPLAY,
  PRICE_SPRINT_DISPLAY,
  PRICE_ENTERPRISE_DISPLAY,
  ROI_REFERENCE_PACKAGE_USD,
  ROI_REFERENCE_PACKAGE_LABEL as CORE_ROI_LABEL,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

export type PricingTier = {
  id: "pilot" | "multi" | "sprint" | "enterprise";
  name: string;
  eyebrow: string;
  /** One-time flat fee in USD. Null for custom scope. */
  oneTime: number | null;
  /** Display string, e.g. "$399", "$2.1K", "$4.5K", "Custom". */
  priceDisplay: string;
  /** Sub-price line (e.g. "≈ $600 per position"). */
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
  "Delivered weekly",
  "Top 10 candidates per position",
  "Ranked candidate shortlist",
  "Scoring with fit notes",
  "Criteria-based ethical ranking",
  "3 months access to candidate data",
];

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "pilot",
    name: "Pilot — Single Position",
    eyebrow: "1 active role",
    oneTime: PRICE_PILOT_USD,
    priceDisplay: `$${PRICE_PILOT_USD}`,
    bestFor: "Test the model on one critical hire.",
    rolesIncluded: "1 active role",
    turnaround: TURNAROUND_LABEL,
    included: BASE_INCLUDED,
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "multi",
    name: "Multi Position",
    eyebrow: "2–5 active roles",
    oneTime: PRICE_MULTI_USD,
    priceDisplay: "$2.1K",
    pricePer: "≈ $600 per position",
    bestFor: "Run parallel searches with shared intake context.",
    rolesIncluded: "2–5 active roles",
    turnaround: TURNAROUND_LABEL,
    included: [
      "Delivered weekly",
      "Top 10 candidates per position",
      "All roles sourced simultaneously",
      "Ranked shortlist per role",
      "Scoring with fit notes",
      "Criteria-based ethical ranking",
      "3 months access to candidate data",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
    highlight: true,
  },
  {
    id: "sprint",
    name: "Hiring Sprint",
    eyebrow: "6–10 active roles",
    oneTime: PRICE_SPRINT_USD,
    priceDisplay: "$4.5K",
    pricePer: "≈ $562 per position",
    bestFor: "Concurrent hiring across functions with priority support.",
    rolesIncluded: "6–10 active roles",
    turnaround: TURNAROUND_LABEL,
    included: [
      "Delivered weekly",
      "Top 10 candidates per position",
      "All roles sourced simultaneously",
      "Ranked shortlist per role",
      "Scoring with fit notes",
      "Criteria-based ethical ranking",
      "3 months access to candidate data",
      "Priority support",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "enterprise",
    name: "Custom Billing",
    eyebrow: "10+ roles or continuous hiring",
    oneTime: null,
    priceDisplay: "Custom",
    bestFor:
      "Continuous hiring across business units, geographies, or 50–5,000-employee operators.",
    rolesIncluded: "Custom scope",
    turnaround: "Custom delivery cadence",
    included: [
      "Everything in Hiring Sprint",
      "Dedicated account structure",
      "Tailored billing and reporting",
      "SLA-backed delivery",
      "SSO, custom data residency, security review",
      "Named executive sponsor",
    ],
    ctaLabel: "Talk to Enterprise",
    ctaTo: "/enterprise",
  },
];

/**
 * Guarantees shown under the pricing tiers.
 */
export const PRICING_GUARANTEES: string[] = [
  "No hidden fees",
  "You keep all candidates",
  "14-day guarantee",
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

/** Reference package price used by ROI calculator (Multi Position). */
export const ROI_REFERENCE_PACKAGE = ROI_REFERENCE_PACKAGE_USD;
export const ROI_REFERENCE_PACKAGE_LABEL = CORE_ROI_LABEL;

export function formatPrice(tier: PricingTier): string {
  return tier.priceDisplay;
}
