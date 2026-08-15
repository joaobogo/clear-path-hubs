/**
 * TaaSFlow — Canonical price anchors (single source of truth)
 * ============================================================
 * Every public surface (Pricing page, Homepage tiers, ROI calculator, agency
 * comparator, proposal templates, intake copy) reads its numeric price from
 * this file. Change values HERE — every consumer updates automatically.
 *
 * Consumers:
 *   src/content/pricing.ts       → tier-card display shape
 *   src/config/public-pricing.ts → calculator/selector shape
 *
 * Rule: never hard-code these numbers anywhere else in the app.
 */

export const PRICE_PILOT_USD = 399;
export const PRICE_MULTI_USD = 2_100;
export const PRICE_SPRINT_USD = 4_500;

/**
 * Monthly subscription anchors — volume-based options.
 * Mirrors taasflow.com/pricing (Subscription tab): Bronze / Silver / Gold / Enterprise.
 * Annual commit saves 10% (applied at checkout / on invoice).
 */
export const PRICE_SUB_BRONZE_USD = 7_000;
export const PRICE_SUB_SILVER_FROM_USD = 7_500;
export const PRICE_SUB_GOLD_FROM_USD = 15_000;
export const PRICE_SUB_BRONZE_DISPLAY = "$7.0K";
export const PRICE_SUB_SILVER_DISPLAY = "From $7.5K";
export const PRICE_SUB_GOLD_DISPLAY = "From $15.0K";
export const PRICE_SUB_ENTERPRISE_DISPLAY = "Custom";
export const SUBSCRIPTION_ANNUAL_DISCOUNT_LABEL = "Save 10% with annual commit";

/**
 * Canonical display strings — every public surface (pricing page, homepage
 * tiers, ROI calculator, pitch/boardroom decks, proposal templates, intake
 * copy) MUST render prices via these constants. Never hard-code the string
 * form elsewhere.
 */
export const PRICE_PILOT_DISPLAY = `$${PRICE_PILOT_USD}`;
export const PRICE_MULTI_DISPLAY = "$2.1K";
export const PRICE_SPRINT_DISPLAY = "$4.5K";
export const PRICE_ENTERPRISE_DISPLAY = "Custom";

/** Position-band descriptors — one source for tier subtitles/eyebrows. */
export const PILOT_ROLES_LABEL = "1 active role";
export const MULTI_ROLES_LABEL = "2–5 active roles";
export const SPRINT_ROLES_LABEL = "6–10 active roles";
export const ENTERPRISE_ROLES_LABEL = "11+ roles or continuous hiring";

/** Multi Position is the reference package used for ROI comparisons. */
export const ROI_REFERENCE_PACKAGE_USD = PRICE_MULTI_USD;
export const ROI_REFERENCE_PACKAGE_LABEL =
  "Multi Position one-off package (2–5 roles)";

/** Turnaround guarantee shared across every published tier. */
export const TURNAROUND_LABEL = "5-day turnaround";

/** Position-band boundaries used by the calculator selector. */
export const POSITION_BANDS = {
  pilot: { min: 1, max: 1 },
  multi: { min: 2, max: 5 },
  sprint: { min: 6, max: 10 },
  subscription: { min: 11, max: null as number | null },
} as const;
