/**
 * TaaSFlow — Canonical public pricing configuration
 * ==================================================
 * Single source of truth for every public marketing surface:
 *   • Pricing page cards
 *   • Homepage ROI calculator (when built)
 *   • Enterprise page teasers
 *   • Any package/tier labels used in marketing copy
 *
 * Rules
 *   • Do NOT hard-code prices elsewhere.
 *   • Do NOT infer checkout prices from this file — it is marketing config.
 *   • Values pending owner sign-off are flagged with approvalStatus !== "approved".
 *     The calculator and Pricing page MUST hide the numeric price and render
 *     a "Contact Sales" affordance for any non-approved tier.
 *   • Update this file (not the components) when pricing changes.
 */

export type BillingType = "one-time-flat" | "monthly-subscription" | "custom";
export type ApprovalStatus = "approved" | "pending" | "review";

export interface PricingPackage {
  /** Machine identifier used in analytics, tests, and internal wiring. */
  id: "pilot" | "multi-position" | "hiring-sprint" | "subscription";
  /** Public-facing name shown on the Pricing page and calculator. */
  name: string;
  /** Public one-line description shown under the package title. */
  description: string;
  /** Inclusive lower bound of positions. */
  minPositions: number;
  /** Inclusive upper bound (null = unbounded, e.g. Subscription 11+). */
  maxPositions: number | null;
  /** Price in USD. null = quote / not published. */
  priceUsd: number | null;
  billingType: BillingType;
  /** True while owner has NOT approved the numeric price for public use. */
  customPricingOnly: boolean;
  /** Sign-off state — controls whether numeric price is rendered. */
  approvalStatus: ApprovalStatus;
  /** ISO date this row was last confirmed. */
  effectiveDate: string;
  /** false = suppress this tier entirely across public surfaces. */
  active: boolean;
}

/**
 * Approved packages. Values reflect the current live source at
 * taasflow.com/pricing. Any change goes through owner review — see
 * docs/migration/calculator-pricing-reconciliation.md.
 */
export const PRICING_PACKAGES: readonly PricingPackage[] = [
  {
    id: "pilot",
    name: "Pilot — Single Position",
    description: "A focused engagement to fill one open role.",
    minPositions: 1,
    maxPositions: 1,
    priceUsd: 399,
    billingType: "one-time-flat",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: "2026-07-23",
    active: true,
  },
  {
    id: "multi-position",
    name: "Multi Position",
    description: "A handful of roles running in parallel.",
    minPositions: 2,
    maxPositions: 5,
    priceUsd: 2100,
    billingType: "one-time-flat",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: "2026-07-23",
    active: true,
  },
  {
    id: "hiring-sprint",
    name: "Hiring Sprint",
    description: "Multiple roles sourced simultaneously.",
    minPositions: 6,
    maxPositions: 10,
    priceUsd: 4500,
    billingType: "one-time-flat",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: "2026-07-23",
    active: true,
  },
  {
    id: "subscription",
    name: "Subscription",
    description: "Continuous hiring across teams and geographies.",
    minPositions: 11,
    maxPositions: null,
    priceUsd: null, // Unapproved — see reconciliation doc.
    billingType: "custom",
    customPricingOnly: true,
    approvalStatus: "review",
    effectiveDate: "2026-07-23",
    active: true,
  },
] as const;

/** Calculator defaults — see calculator-behavior.md. */
export const CALCULATOR_DEFAULTS = {
  positions: 5,
  agencyFeePct: 0.20,
  averageSalaryUsd: 85_000, // owner-review pending
  recruiterHourlyUsd: 40,
  sourcingHoursPerRole: 25,
} as const;

export const CALCULATOR_LIMITS = {
  positions:            { min: 1,      max: 20,    step: 1 },
  agencyFeePct:         { min: 0.10,   max: 0.30,  step: 0.01 },
  averageSalaryUsd:     { min: 40_000, max: 250_000, step: 5_000 },
  recruiterHourlyUsd:   { min: 20,     max: 150,   step: 5 },
  sourcingHoursPerRole: { min: 5,      max: 80,    step: 5 },
} as const;

export const CALCULATOR_DISCLAIMER =
  "Estimates are directional and depend on role volume, salary, package, hiring complexity, and client context. Based on SHRM & Ashby 2025 benchmarks.";

/**
 * Calculator presets — one-click assumption bundles.
 * Presets only change input assumptions; math still runs against approved
 * pricing. No fabricated results, no fake savings.
 */
export interface CalculatorPreset {
  id: "one-critical" | "growing-team" | "hiring-sprint" | "high-volume";
  label: string;
  description: string;
  inputs: {
    positions: number;
    averageSalaryUsd: number;
    agencyFeePct: number;
    recruiterHourlyUsd: number;
    sourcingHoursPerRole: number;
  };
}

export const CALCULATOR_PRESETS: readonly CalculatorPreset[] = [
  {
    id: "one-critical",
    label: "One Critical Hire",
    description: "A single senior role you can't afford to get wrong.",
    inputs: { positions: 1, averageSalaryUsd: 120_000, agencyFeePct: 0.22, recruiterHourlyUsd: 50, sourcingHoursPerRole: 35 },
  },
  {
    id: "growing-team",
    label: "Growing Team",
    description: "A handful of roles as the team scales.",
    inputs: { positions: 3, averageSalaryUsd: 90_000, agencyFeePct: 0.20, recruiterHourlyUsd: 40, sourcingHoursPerRole: 25 },
  },
  {
    id: "hiring-sprint",
    label: "Hiring Sprint",
    description: "Several roles running in parallel.",
    inputs: { positions: 8, averageSalaryUsd: 85_000, agencyFeePct: 0.20, recruiterHourlyUsd: 40, sourcingHoursPerRole: 25 },
  },
  {
    id: "high-volume",
    label: "High Volume",
    description: "Continuous hiring across teams.",
    inputs: { positions: 15, averageSalaryUsd: 80_000, agencyFeePct: 0.18, recruiterHourlyUsd: 40, sourcingHoursPerRole: 20 },
  },
] as const;

/** Return the package that covers `positions`, or null when out of range. */
export function selectPackage(positions: number): PricingPackage | null {
  if (!Number.isFinite(positions) || positions < 1) return null;
  for (const pkg of PRICING_PACKAGES) {
    if (!pkg.active) continue;
    const max = pkg.maxPositions ?? Number.POSITIVE_INFINITY;
    if (positions >= pkg.minPositions && positions <= max) return pkg;
  }
  return null;
}

/** True iff the tier's numeric price is safe to display publicly. */
export function isTierPricePublic(pkg: PricingPackage): boolean {
  return (
    pkg.active &&
    pkg.approvalStatus === "approved" &&
    !pkg.customPricingOnly &&
    pkg.priceUsd !== null
  );
}

/** USD, no decimals, K-abbreviated over $1,000. Mirrors source formatter. */
export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  const k = value / 1000;
  const rounded = Math.round(k * 10) / 10;
  const str = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `$${str}K`;
}
