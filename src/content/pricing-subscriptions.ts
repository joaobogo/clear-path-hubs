/**
 * Subscription pricing — the SAME three packages at the SAME prices as one-off,
 * billed monthly instead of once. One rule, one place:
 * src/config/pricing-core.ts.
 *
 * A subscription card says what capacity you get each month and what it costs
 * each month. There is no annual discount, no per-position figure, and no
 * package described as a range between two counts.
 */
import {
  PILOT_PACKAGE,
  PACKAGE_10,
  PACKAGE_20,
  PACKAGE_30,
  PILOT_ROLES_LABEL,
  ABOVE_MAX_DISPLAY,
  ABOVE_MAX_ROLES_LABEL,
  ABOVE_MAX_CTA_LABEL,
} from "@/config/pricing-core";

export type SubscriptionTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "enterprise";
  name: string;
  eyebrow: string;
  /** The one exact monthly total for this package. Null above the maximum. */
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
    name: "Pilot",
    eyebrow: PILOT_ROLES_LABEL,
    monthly: PILOT_PACKAGE.totalUsd,
    priceDisplay: PILOT_PACKAGE.totalDisplay,
    priceSuffix: "one position",
    billingNote: "Billed once — one pilot per company",
    bestFor: "One position, the full workflow.",
    rolesIncluded: PILOT_ROLES_LABEL,
    included: BASE,
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "growth",
    name: PACKAGE_10.capacityLabel,
    eyebrow: PACKAGE_10.capacityLabel,
    monthly: PACKAGE_10.totalUsd,
    priceDisplay: PACKAGE_10.totalDisplay,
    priceSuffix: "a month",
    billingNote: "Billed monthly",
    bestFor: `${PACKAGE_10.capacityLabel} running together, every month.`,
    rolesIncluded: PACKAGE_10.capacityLabel,
    included: [...BASE, "Dedicated support"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
    highlight: true,
  },
  {
    id: "scale",
    name: PACKAGE_20.capacityLabel,
    eyebrow: PACKAGE_20.capacityLabel,
    monthly: PACKAGE_20.totalUsd,
    priceDisplay: PACKAGE_20.totalDisplay,
    priceSuffix: "a month",
    billingNote: "Billed monthly",
    bestFor: `${PACKAGE_20.capacityLabel} running together, every month.`,
    rolesIncluded: PACKAGE_20.capacityLabel,
    included: [...BASE, "Priority support", "Faster calibration cycles"],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "volume",
    name: PACKAGE_30.capacityLabel,
    eyebrow: PACKAGE_30.capacityLabel,
    monthly: PACKAGE_30.totalUsd,
    priceDisplay: PACKAGE_30.totalDisplay,
    priceSuffix: "a month",
    billingNote: "Billed monthly",
    bestFor: `${PACKAGE_30.capacityLabel} running together, every month.`,
    rolesIncluded: PACKAGE_30.capacityLabel,
    included: [
      ...BASE,
      "Dedicated account manager",
      "Custom reporting",
      "Executive portfolio dashboard",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/book",
  },
  {
    id: "enterprise",
    name: ABOVE_MAX_ROLES_LABEL,
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    monthly: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    priceSuffix: "Scoped with you",
    billingNote: ABOVE_MAX_ROLES_LABEL,
    bestFor: "Above the published maximum we scope it with you.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    included: [
      ...BASE,
      `Everything in ${PACKAGE_30.capacityLabel}`,
      "White-glove onboarding",
      "Strategic planning sessions",
    ],
    ctaLabel: ABOVE_MAX_CTA_LABEL,
    ctaTo: "/enterprise",
  },
];
