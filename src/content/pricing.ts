// Canonical pricing configuration — single source of truth.
// Consumed by: /pricing, /roi calculator, homepage cost band, agency comparator.
//
// GUARDRAIL: Prices below are indicative starting points published to give
// buyers commercial confidence. The exact price is confirmed on the scoped
// quote once the intake is complete. Do not add fabricated discounts,
// promotions, or "was $X now $Y" language.

export type PricingTier = {
  id: "starter" | "growth" | "scale" | "enterprise";
  name: string;
  eyebrow: string;
  /** Base monthly USD. Null for "quote-only" (enterprise). */
  monthly: number | null;
  /** Best-fit descriptor — no fake company sizes. */
  bestFor: string;
  /** Active roles included in the base subscription. */
  rolesIncluded: number | "custom";
  /** Weekly ranked-delivery cadence per role. */
  weeklyDelivery: string;
  /** Included capabilities — every capability is a real product feature. */
  included: string[];
  /** Line on the CTA button. */
  ctaLabel: string;
  ctaTo: string;
  highlight?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    eyebrow: "One active role",
    monthly: 2400,
    bestFor: "Teams testing the model on one critical hire.",
    rolesIncluded: 1,
    weeklyDelivery: "Weekly ranked shortlist",
    included: [
      "Guided intake and search plan",
      "Role-specific evidence-based scoring",
      "Recruiter-written fit narratives with CV quotes",
      "Client workspace with Kanban pipeline",
      "Direct workspace messaging",
      "Full audit trail on every decision",
      "Direct handover after shortlist",
    ],
    ctaLabel: "Start with one role",
    ctaTo: "/intake",
  },
  {
    id: "growth",
    name: "Growth",
    eyebrow: "Up to three parallel roles",
    monthly: 5900,
    bestFor: "Series A–C operators running multiple parallel searches.",
    rolesIncluded: 3,
    weeklyDelivery: "Weekly ranked shortlist per role",
    included: [
      "Everything in Starter",
      "Shared intake context across roles",
      "One recruiter pod on every search",
      "Portfolio view across roles",
      "Priority workspace response",
      "Reusable candidate pipeline between roles",
    ],
    ctaLabel: "Scope three roles",
    ctaTo: "/intake",
    highlight: true,
  },
  {
    id: "scale",
    name: "Scale",
    eyebrow: "Up to eight parallel roles",
    monthly: 12500,
    bestFor: "Operators with concurrent hiring across functions or regions.",
    rolesIncluded: 8,
    weeklyDelivery: "Twice-weekly delivery on priority roles",
    included: [
      "Everything in Growth",
      "Dedicated recruiter pod",
      "Custom scoring rubrics per function",
      "Multi-region sourcing",
      "Named engagement lead",
      "Quarterly hiring review",
    ],
    ctaLabel: "Scope multi-role search",
    ctaTo: "/intake",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    eyebrow: "Custom scope",
    monthly: null,
    bestFor:
      "Continuous hiring across business units, geographies, or 50-5,000-employee operators.",
    rolesIncluded: "custom",
    weeklyDelivery: "Custom delivery cadence",
    included: [
      "Everything in Scale",
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
 * "What you will never see on a TaaSFlow invoice."
 * Shared across pricing UI + agency comparator.
 */
export const NEVER_CHARGED: string[] = [
  "Placement fees",
  "Salary-percentage commissions",
  "Per-CV pass-through charges",
  "Hidden markups on interviews or offers",
];

/** Reference monthly used by ROI calculator when no user override. */
export const ROI_REFERENCE_MONTHLY = 5900;

export function formatMonthly(tier: PricingTier): string {
  if (tier.monthly === null) return "Custom";
  return `$${tier.monthly.toLocaleString("en-US")}`;
}
