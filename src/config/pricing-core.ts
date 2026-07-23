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

/** Multi Position is the reference package used for ROI comparisons. */
export const ROI_REFERENCE_PACKAGE_USD = PRICE_MULTI_USD;
export const ROI_REFERENCE_PACKAGE_LABEL =
  "Multi Position one-off package (2–5 roles)";

/** Turnaround guarantee shared across every published tier. */
export const TURNAROUND_LABEL = "14-day turnaround";

/** Position-band boundaries used by the calculator selector. */
export const POSITION_BANDS = {
  pilot: { min: 1, max: 1 },
  multi: { min: 2, max: 5 },
  sprint: { min: 6, max: 10 },
  subscription: { min: 11, max: null as number | null },
} as const;
