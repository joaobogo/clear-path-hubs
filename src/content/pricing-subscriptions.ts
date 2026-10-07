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
import {
  SHORTLIST_LABEL,
  FIRST_SHORTLIST_TIMING_SHORT,
  PILOT_IS_PAID_NOTE,
} from "@/config/offer-facts";
import { CTA_PRIMARY, CTA_BOOK, CTA_ENTERPRISE } from "@/config/cta";
import { publicSeatsLine, SCOPED_PUBLIC_LABEL } from "@/config/pricing-entitlements";

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
  /** Shown as a card on /pricing; the rest go in the comparison table. */
  card: boolean;
};

/**
 * Same order on every card: capacity, shortlist, timing, recruiter review,
 * seats, records. Extras come after.
 */
function includedFor(planId: string, capacity: string, extras: string[] = []): string[] {
  return [
    capacity,
    planId === "pilot" ? SHORTLIST_LABEL : `${SHORTLIST_LABEL} for each position`,
    FIRST_SHORTLIST_TIMING_SHORT,
    "A recruiter reviews every shortlist before you see it",
    planId === "enterprise"
      ? `Seats: ${SCOPED_PUBLIC_LABEL.toLowerCase()}`
      : `Seats: ${publicSeatsLine(planId)}`,
    "Export your candidate records at any time",
    "Evidence-backed scoring with fit notes",
    "Hiring Intelligence reporting",
    ...extras,
  ];
}

const BASE_TIERS: SubscriptionTier[] = [
  {
    id: "pilot",
    name: "Pilot",
    eyebrow: PILOT_ROLES_LABEL,
    monthly: PILOT_PACKAGE.totalUsd,
    priceDisplay: PILOT_PACKAGE.totalDisplay,
    priceSuffix: "for one position",
    billingNote: "Paid once. One pilot per company.",
    bestFor: PILOT_IS_PAID_NOTE,
    rolesIncluded: PILOT_ROLES_LABEL,
    included: includedFor("pilot", "1 position, one pilot per company"),
    ctaLabel: CTA_PRIMARY.label,
    ctaTo: CTA_PRIMARY.to,
    highlight: true,
    card: true,
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
    included: includedFor("growth", PACKAGE_10.capacityLabel, ["Dedicated support"]),
    ctaLabel: CTA_BOOK.label,
    ctaTo: CTA_BOOK.to,
    card: true,
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
    included: includedFor("scale", PACKAGE_20.capacityLabel, ["Priority support", "Faster calibration cycles"]),
    ctaLabel: CTA_BOOK.label,
    ctaTo: CTA_BOOK.to,
    card: true,
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
    included: includedFor("volume", PACKAGE_30.capacityLabel, ["Dedicated account manager", "Custom reporting", "Executive portfolio dashboard"]),
    ctaLabel: CTA_BOOK.label,
    ctaTo: CTA_BOOK.to,
    card: true,
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
    included: includedFor("portfolio", PACKAGE_40.capacityLabel, ["Dedicated account manager", "Custom reporting", "Executive portfolio dashboard"]),
    ctaLabel: CTA_BOOK.label,
    ctaTo: CTA_BOOK.to,
    card: false,
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
    included: includedFor("program", PACKAGE_100.capacityLabel, ["Dedicated account manager", "Custom reporting", "Executive portfolio dashboard", "Named executive sponsor"]),
    ctaLabel: CTA_BOOK.label,
    ctaTo: CTA_BOOK.to,
    card: false,
  },
  {
    id: "enterprise",
    name: ABOVE_MAX_ROLES_LABEL,
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    monthly: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    priceSuffix: SCOPED_PUBLIC_LABEL,
    billingNote: ABOVE_MAX_ROLES_LABEL + ": scoped",
    bestFor: "Above the largest published package, we scope it with your account team.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    included: includedFor("enterprise", `Everything in ${PACKAGE_100.capacityLabel}, scoped to your volume`),
    ctaLabel: CTA_ENTERPRISE.label,
    ctaTo: CTA_ENTERPRISE.to,
    card: false,
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
