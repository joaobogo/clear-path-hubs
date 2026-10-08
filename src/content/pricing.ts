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
} from "@/config/pricing-core";
import {
  SHORTLIST_LABEL,
  FIRST_SHORTLIST_TIMING_SHORT,
  PILOT_IS_PAID_NOTE,
} from "@/config/offer-facts";
import { CTA_PRIMARY, CTA_MESSAGE, CTA_ENTERPRISE } from "@/config/cta";
import { publicSeatsLine, SCOPED_PUBLIC_LABEL } from "@/config/pricing-entitlements";

export type PricingTier = {
  id: "pilot" | "growth" | "scale" | "volume" | "portfolio" | "program" | "enterprise";
  name: string;
  eyebrow: string;
  /** The one exact total in USD for this package. Null above the maximum. */
  oneTime: number | null;
  /** Display string — the exact package total, or the talk-to-us label. */
  priceDisplay: string;
  /** Billing in plain words ("Paid once"). Never a per-position figure. */
  pricePer?: string;
  /** Best-fit descriptor. */
  bestFor: string;
  /** Capacity sentence — always "up to" and a single number. */
  rolesIncluded: string;
  /** When the first shortlist usually arrives. Never a guarantee. */
  turnaround: string;
  /** Included capabilities. */
  included: string[];
  /** CTA. */
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
  /** Shown as a card on /pricing; the rest go in the comparison table. */
  card: boolean;
};

/**
 * Every card lists the same things in the same order so cards can be compared:
 * capacity, shortlist, timing, recruiter review, seats, records. Anything a
 * package adds comes after.
 */
function includedFor(
  planId: string,
  capacity: string,
  perPosition: boolean,
  extras: string[] = [],
): string[] {
  return [
    capacity,
    perPosition ? `${SHORTLIST_LABEL} for each position` : SHORTLIST_LABEL,
    FIRST_SHORTLIST_TIMING_SHORT,
    "A recruiter reviews every shortlist before you see it",
    planId === "enterprise" ? `Seats: ${SCOPED_PUBLIC_LABEL.toLowerCase()}` : `Seats: ${publicSeatsLine(planId)}`,
    "Export your candidate records at any time; workspace access lasts three months",
    "Evidence-backed scoring with fit notes",
    "Hiring Intelligence reporting",
    ...extras,
  ];
}

/** What every package includes. Used for the "included on every plan" list. */
export const INCLUDED_ON_EVERY_PLAN: string[] = [
  SHORTLIST_LABEL + " per position",
  "A recruiter reviews every shortlist before you see it",
  "Evidence-backed scoring with fit notes",
  "Criteria-based ranking; you make every hiring decision",
  "Export your candidate records at any time",
];

const PAID_ONCE = "Paid once";

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "pilot",
    name: "Pilot",
    eyebrow: `One role · ${PILOT_ROLES_LABEL} · 1 per company`,
    oneTime: PILOT_PACKAGE.totalUsd,
    priceDisplay: PILOT_PACKAGE.totalDisplay,
    pricePer: `${PAID_ONCE}. One pilot per company.`,
    bestFor: PILOT_IS_PAID_NOTE,
    rolesIncluded: PILOT_ROLES_LABEL,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("pilot", "1 position, one pilot per company", false),
    ctaLabel: CTA_PRIMARY.label,
    ctaTo: CTA_PRIMARY.to,
    highlight: true,
    card: true,
  },
  {
    id: "growth",
    name: PACKAGE_10.capacityLabel,
    eyebrow: PACKAGE_10.capacityLabel,
    oneTime: PACKAGE_10.totalUsd,
    priceDisplay: PACKAGE_10.totalDisplay,
    pricePer: PAID_ONCE,
    bestFor: "Run parallel searches with shared intake context.",
    rolesIncluded: PACKAGE_10.capacityLabel,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("growth", PACKAGE_10.capacityLabel, true),
    ctaLabel: CTA_MESSAGE.label,
    ctaTo: CTA_MESSAGE.to,
    card: true,
  },
  {
    id: "scale",
    name: PACKAGE_20.capacityLabel,
    eyebrow: PACKAGE_20.capacityLabel,
    oneTime: PACKAGE_20.totalUsd,
    priceDisplay: PACKAGE_20.totalDisplay,
    pricePer: PAID_ONCE,
    bestFor: "Concurrent hiring across functions with priority support.",
    rolesIncluded: PACKAGE_20.capacityLabel,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("scale", PACKAGE_20.capacityLabel, true, ["Priority support"]),
    ctaLabel: CTA_MESSAGE.label,
    ctaTo: CTA_MESSAGE.to,
    card: true,
  },
  {
    id: "volume",
    name: PACKAGE_30.capacityLabel,
    eyebrow: PACKAGE_30.capacityLabel,
    oneTime: PACKAGE_30.totalUsd,
    priceDisplay: PACKAGE_30.totalDisplay,
    pricePer: PAID_ONCE,
    bestFor: "Portfolio hiring across teams in one package.",
    rolesIncluded: PACKAGE_30.capacityLabel,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("volume", PACKAGE_30.capacityLabel, true, [
      "Priority support",
      "Dedicated account manager",
      "Executive portfolio dashboard",
    ]),
    ctaLabel: CTA_MESSAGE.label,
    ctaTo: CTA_MESSAGE.to,
    card: true,
  },
  {
    id: "portfolio",
    name: PACKAGE_40.capacityLabel,
    eyebrow: PACKAGE_40.capacityLabel,
    oneTime: PACKAGE_40.totalUsd,
    priceDisplay: PACKAGE_40.totalDisplay,
    pricePer: PAID_ONCE,
    bestFor: "Portfolio hiring across business units.",
    rolesIncluded: PACKAGE_40.capacityLabel,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("portfolio", PACKAGE_40.capacityLabel, true, [
      "Priority support",
      "Dedicated account manager",
      "Executive portfolio dashboard",
    ]),
    ctaLabel: CTA_MESSAGE.label,
    ctaTo: CTA_MESSAGE.to,
    card: false,
  },
  {
    id: "program",
    name: PACKAGE_100.capacityLabel,
    eyebrow: PACKAGE_100.capacityLabel,
    oneTime: PACKAGE_100.totalUsd,
    priceDisplay: PACKAGE_100.totalDisplay,
    pricePer: PAID_ONCE,
    bestFor: "A continuous hiring programme run as one package.",
    rolesIncluded: PACKAGE_100.capacityLabel,
    turnaround: FIRST_SHORTLIST_TIMING_SHORT,
    included: includedFor("program", PACKAGE_100.capacityLabel, true, [
      "Priority support",
      "Dedicated account manager",
      "Executive portfolio dashboard",
      "Named executive sponsor",
    ]),
    ctaLabel: CTA_MESSAGE.label,
    ctaTo: CTA_MESSAGE.to,
    card: false,
  },
  {
    id: "enterprise",
    name: ABOVE_MAX_ROLES_LABEL,
    eyebrow: ABOVE_MAX_ROLES_LABEL,
    oneTime: null,
    priceDisplay: ABOVE_MAX_DISPLAY,
    pricePer: SCOPED_PUBLIC_LABEL,
    bestFor:
      "Continuous hiring across business units or geographies, scoped with your account team.",
    rolesIncluded: ABOVE_MAX_ROLES_LABEL,
    turnaround: SCOPED_PUBLIC_LABEL,
    included: includedFor("enterprise", `Everything in ${PACKAGE_100.capacityLabel}, scoped to your volume`, true),
    ctaLabel: CTA_ENTERPRISE.label,
    ctaTo: CTA_ENTERPRISE.to,
    card: false,
  },
];

/**
 * Guarantees shown under the pricing packages.
 */
export const PRICING_GUARANTEES: string[] = [
  "No hidden fees",
  "No placement fee",
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
