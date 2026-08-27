/**
 * Subscription pricing — the SAME three packages at the SAME prices as one-off,
 * billed monthly instead of once. One rule, one place:
 * src/config/pricing-core.ts.
 *
 * A subscription card says what capacity you get each month and what it costs
 * each month. Paying twelve months up front takes 10% off the annual total —
 * the only discount we publish, and it never changes the monthly price. No
 * per-position figure, and no package described as a range between two counts.
 */
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
  ANNUAL_DISCOUNT_DISPLAY,
  ANNUAL_DISCOUNT_PCT,
  formatUsdExact,
} from "@/config/pricing-core";

export type SubscriptionTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "portfolio" | "program" | "enterprise";
  name: string;
  eyebrow: string;
  /** The one exact monthly total for this package. Null above the maximum. */
  monthly: number | null;
  priceDisplay: string;
  priceSuffix: string;
  billingNote: string;
  /** Twelve months paid up front, 10% off. Null where no price is published. */
  annual?: number | null;
  annualDisplay?: string;
  /** What the annual prepayment saves, e.g. "Save $9,600 a year". */
  annualSavingsNote?: string;
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

const BASE_TIERS: SubscriptionTier[] = [
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
    id: "portfolio",
    name: PACKAGE_40.capacityLabel,
    eyebrow: PACKAGE_40.capacityLabel,
    monthly: PACKAGE_40.totalUsd,
    priceDisplay: PACKAGE_40.totalDisplay,
    priceSuffix: "a month",
    billingNote: "Billed monthly",
    bestFor: `${PACKAGE_40.capacityLabel} running together, every month.`,
    rolesIncluded: PACKAGE_40.capacityLabel,
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
    id: "program",
    name: PACKAGE_100.capacityLabel,
    eyebrow: PACKAGE_100.capacityLabel,
    monthly: PACKAGE_100.totalUsd,
    priceDisplay: PACKAGE_100.totalDisplay,
    priceSuffix: "a month",
    billingNote: "Billed monthly",
    bestFor: `${PACKAGE_100.capacityLabel} running together, every month.`,
    rolesIncluded: PACKAGE_100.capacityLabel,
    included: [
      ...BASE,
      "Dedicated account manager",
      "Custom reporting",
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
    monthly: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    priceSuffix: "Scoped with you",
    billingNote: ABOVE_MAX_ROLES_LABEL,
    bestFor: "Above the published maximum we scope it with you.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    included: [
      ...BASE,
      `Everything in ${PACKAGE_100.capacityLabel}`,
      "White-glove onboarding",
      "Strategic planning sessions",
    ],
    ctaLabel: ABOVE_MAX_CTA_LABEL,
    ctaTo: "/enterprise",
  },
];

/** Every published subscription tier, with annual-prepay figures filled in. */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = BASE_TIERS.map(withAnnual);

/**
 * Fill the annual-prepay fields from the one rule in pricing-core. Tiers with
 * no published monthly price (above the maximum) get no annual price either.
 */
function withAnnual(tier: SubscriptionTier): SubscriptionTier {
  if (tier.monthly === null) {
    return { ...tier, annual: null, annualDisplay: ABOVE_MAX_DISPLAY };
  }
  const annual = Math.round(tier.monthly * 12 * (1 - ANNUAL_DISCOUNT_PCT));
  const savings = tier.monthly * 12 - annual;
  return {
    ...tier,
    annual,
    annualDisplay: formatUsdExact(annual),
    annualSavingsNote: `Save ${formatUsdExact(savings)} a year — ${ANNUAL_DISCOUNT_DISPLAY} off when you pay twelve months up front.`,
  };
}
