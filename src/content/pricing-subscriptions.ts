/**
 * Subscription pricing — mirrors taasflow.com/pricing (Subscription tab).
 * Bronze / Silver / Gold / Enterprise volume-based monthly plans.
 * Numeric values come from src/config/pricing-core.ts.
 */
import {
  PRICE_SUB_BRONZE_USD,
  PRICE_SUB_SILVER_FROM_USD,
  PRICE_SUB_GOLD_FROM_USD,
  PRICE_SUB_BRONZE_DISPLAY,
  PRICE_SUB_SILVER_DISPLAY,
  PRICE_SUB_GOLD_DISPLAY,
  PRICE_SUB_ENTERPRISE_DISPLAY,
} from "@/config/pricing-core";

export type SubscriptionTier = {
  id: "bronze" | "silver" | "gold" | "enterprise";
  name: string;
  eyebrow: string;
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

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    eyebrow: "Up to 15 positions per month",
    monthly: PRICE_SUB_BRONZE_USD,
    priceDisplay: PRICE_SUB_BRONZE_DISPLAY,
    priceSuffix: "per month",
    billingNote: "Billed at start of month",
    bestFor: "Up to 15 positions per month",
    rolesIncluded: "Up to 15 positions per month",
    included: [
      "Top 10 candidates per position",
      "Ranked shortlists refreshed weekly",
      "Evidence-backed scoring with fit notes",
      "Hiring Intelligence reporting",
      "Dedicated support",
      "3 months candidate-record retention",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "silver",
    name: "Silver",
    eyebrow: "16–30 positions per month",
    monthly: PRICE_SUB_SILVER_FROM_USD,
    priceDisplay: PRICE_SUB_SILVER_DISPLAY,
    priceSuffix: "per month",
    billingNote: "Billed at start of month",
    bestFor: "16 to 30 positions per month",
    rolesIncluded: "16 to 30 positions per month",
    included: [
      "Top 10 candidates per position",
      "Everything in Bronze",
      "Priority support",
      "Faster calibration cycles",
      "3 months candidate-record retention",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
    highlight: true,
  },
  {
    id: "gold",
    name: "Gold",
    eyebrow: "31–50 positions per month",
    monthly: PRICE_SUB_GOLD_FROM_USD,
    priceDisplay: PRICE_SUB_GOLD_DISPLAY,
    priceSuffix: "per month",
    billingNote: "Billed at start of month",
    bestFor: "31 to 50 positions per month",
    rolesIncluded: "31 to 50 positions per month",
    included: [
      "Top 10 candidates per position",
      "Everything in Silver",
      "Dedicated account manager",
      "Custom reporting",
      "3 months candidate-record retention",
    ],
    ctaLabel: "Book a discovery call",
    ctaTo: "/contact",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "50+ positions per month",
    monthly: null,
    priceDisplay: PRICE_SUB_ENTERPRISE_DISPLAY,
    priceSuffix: "Tailored to your needs",
    billingNote: "50+ positions per month",
    bestFor: "50+ positions per month",
    rolesIncluded: "50+ positions per month",
    included: [
      "Top 10 candidates per position",
      "Everything in Gold",
      "Custom pricing based on industry and volume",
      "White-glove onboarding",
      "Strategic planning sessions",
      "3 months candidate-record retention",
    ],
    ctaLabel: "Contact Sales",
    ctaTo: "/enterprise",
  },
];
