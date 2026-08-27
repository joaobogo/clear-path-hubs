/**
 * Subscription pricing — the SAME rates as one-off. There is one rule and it
 * lives in src/config/pricing-core.ts: $699 for a single position, then $900
 * (2–10), $850 (11–20) and $800 (21–30) per position, 30 maximum.
 * Never render a band as a price and never precede a price with "From".
 */
import {
  PRICE_PILOT_USD,
  PRICE_PILOT_DISPLAY,
  GROWTH_RATE_USD,
  SCALE_RATE_USD,
  VOLUME_RATE_USD,
  GROWTH_RATE_DISPLAY,
  SCALE_RATE_DISPLAY,
  VOLUME_RATE_DISPLAY,
  PILOT_ROLES_LABEL,
  GROWTH_ROLES_LABEL,
  SCALE_ROLES_LABEL,
  VOLUME_ROLES_LABEL,
  ABOVE_MAX_DISPLAY,
  ABOVE_MAX_ROLES_LABEL,
  ABOVE_MAX_CTA_LABEL,
  PER_POSITION_SUFFIX,
} from "@/config/pricing-core";

export type SubscriptionTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "enterprise";
  name: string;
  eyebrow: string;
  /** Exact monthly amount for the pilot, or the per-position rate for bands. */
  monthly: number | null;
  priceDisplay: string;
  priceSuffix: string;
  billingNote: string;
  bestFor: string;
  rolesIncluded: string;
  included: string[];
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
};

const BASE = [
  "Top 10 candidates per position",
  "Ranked shortlists refreshed weekly",
  "Evidence-backed scoring with fit notes",
  "Hiring Intelligence reporting",
  "3 months candidate-record retention",
];

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "pilot",
    name: "Single position",
    eyebrow: PILOT_ROLES_LABEL,
    monthly: PRICE_PILOT_USD,
    priceDisplay: PRICE_PILOT_DISPLAY,
    priceSuffix: "flat, one position",
    billingNote: "Billed once — one pilot per company",
    bestFor: "One position, the full workflow.",
    rolesIncluded: PILOT_ROLES_LABEL,
    included: BASE,
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "growth",
    name: "2 to 10 positions",
    eyebrow: GROWTH_ROLES_LABEL,
    monthly: GROWTH_RATE_USD,
    priceDisplay: GROWTH_RATE_DISPLAY,
    priceSuffix: PER_POSITION_SUFFIX,
    billingNote: "Billed at start of month",
    bestFor: "2 to 10 positions running together.",
    rolesIncluded: GROWTH_ROLES_LABEL,
    included: [...BASE, "Dedicated support"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
    highlight: true,
  },
  {
    id: "scale",
    name: "11 to 20 positions",
    eyebrow: SCALE_ROLES_LABEL,
    monthly: SCALE_RATE_USD,
    priceDisplay: SCALE_RATE_DISPLAY,
    priceSuffix: PER_POSITION_SUFFIX,
    billingNote: "Billed at start of month",
    bestFor: "11 to 20 positions running together.",
    rolesIncluded: SCALE_ROLES_LABEL,
    included: [...BASE, "Priority support", "Faster calibration cycles"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "volume",
    name: "21 to 30 positions",
    eyebrow: VOLUME_ROLES_LABEL,
    monthly: VOLUME_RATE_USD,
    priceDisplay: VOLUME_RATE_DISPLAY,
    priceSuffix: PER_POSITION_SUFFIX,
    billingNote: "Billed at start of month",
    bestFor: "21 to 30 positions running together.",
    rolesIncluded: VOLUME_ROLES_LABEL,
    included: [
      ...BASE,
      "Dedicated account manager",
      "Custom reporting",
      "Executive portfolio dashboard",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "enterprise",
    name: "More than 30 positions",
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    monthly: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    priceSuffix: "Scoped with you",
    billingNote: ABOVE_MAX_ROLES_LABEL,
    bestFor: "Above 30 positions we scope it with you.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    included: [
      ...BASE,
      "Everything in 21 to 30 positions",
      "White-glove onboarding",
      "Strategic planning sessions",
    ],
    ctaLabel: ABOVE_MAX_CTA_LABEL,
    ctaTo: "/enterprise",
  },
];
