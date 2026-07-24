/**
 * Subscription pricing — continuous hiring programmes.
 * Numeric values come from src/config/pricing-core.ts.
 */
import {
  PRICE_SUB_GROWTH_USD,
  PRICE_SUB_SCALE_USD,
  PRICE_SUB_GROWTH_DISPLAY,
  PRICE_SUB_SCALE_DISPLAY,
  PRICE_SUB_ENTERPRISE_DISPLAY,
  TURNAROUND_LABEL,
} from "@/config/pricing-core";

export type SubscriptionTier = {
  id: "growth" | "scale" | "enterprise";
  name: string;
  eyebrow: string;
  monthly: number | null;
  priceDisplay: string;
  pricePer?: string;
  bestFor: string;
  rolesIncluded: string;
  turnaround: string;
  included: string[];
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
};

const SUB_BASE = [
  "Delivered weekly",
  "Top 10 candidates per active role",
  "Ranked shortlists with fit notes",
  "Criteria-based ethical scoring",
  "Rollover of unfilled roles month-to-month",
  "Persistent talent pool + silver medalists",
  "Dedicated workspace + Slack channel",
];

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "growth",
    name: "Growth Subscription",
    eyebrow: "Up to 3 concurrent roles",
    monthly: PRICE_SUB_GROWTH_USD,
    priceDisplay: PRICE_SUB_GROWTH_DISPLAY,
    pricePer: "≈ $633 per active role / month",
    bestFor: "Steady pipeline for scale-ups hiring 2–3 roles at a time.",
    rolesIncluded: "Up to 3 concurrent roles",
    turnaround: TURNAROUND_LABEL,
    included: SUB_BASE,
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "scale",
    name: "Scale Subscription",
    eyebrow: "Up to 6 concurrent roles",
    monthly: PRICE_SUB_SCALE_USD,
    priceDisplay: PRICE_SUB_SCALE_DISPLAY,
    pricePer: "≈ $600 per active role / month",
    bestFor: "Continuous multi-function hiring across teams and geographies.",
    rolesIncluded: "Up to 6 concurrent roles",
    turnaround: TURNAROUND_LABEL,
    included: [
      ...SUB_BASE,
      "Priority delivery + named recruiter",
      "Quarterly hiring review",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise Subscription",
    eyebrow: "7+ concurrent roles or multi-BU",
    monthly: null,
    priceDisplay: PRICE_SUB_ENTERPRISE_DISPLAY,
    bestFor: "Programmatic hiring across business units with procurement, SSO, and MSA.",
    rolesIncluded: "Custom scope",
    turnaround: "Custom delivery cadence",
    included: [
      "Everything in Scale",
      "Dedicated account team + executive sponsor",
      "SSO, custom data residency, security review",
      "Tailored SLA and reporting cadence",
      "Volume + multi-year pricing",
    ],
    ctaLabel: "Talk to Enterprise",
    ctaTo: "/enterprise",
  },
];
