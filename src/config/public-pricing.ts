/**
 * TaaSFlow — Calculator/selector shape for public pricing.
 * =======================================================
 * Every number here comes from src/config/pricing-core.ts, which holds the
 * only pricing rule: $699 for one position, then $900 (2–10), $850 (11–20),
 *
 * Rules
 *   • Never hard-code a price in this file.
 *   • Never show a band or a range as a price, and never write "From".
 *   • Totals shown to a visitor are the exact final totals from
 *     `positionsTotalUsd()`.
 */

import {
  PRICE_PILOT_USD,
  MAX_POSITIONS,
  PACKAGE_10,
  PACKAGE_20,
  PACKAGE_30,
  PACKAGE_40,
  PACKAGE_100,
  positionsTotalUsd,
  formatUsdExact,
} from "@/config/pricing-core";

export type BillingType = "one-time-flat" | "package" | "custom";
export type ApprovalStatus = "approved" | "pending" | "review";

export interface PricingPackage {
  /** Machine identifier used in analytics, tests, and internal wiring. */
  id: "pilot" | "growth" | "scale" | "volume" | "portfolio" | "program" | "above-max";
  /** Public-facing name shown on the Pricing page and calculator. */
  name: string;
  /** Public one-line description shown under the package title. */
  description: string;
  /** Inclusive lower bound of positions. */
  minPositions: number;
  /** Inclusive upper bound (null = unbounded, i.e. above the maximum). */
  maxPositions: number | null;
  /** Exact total in USD when the band is a single position. null otherwise. */
  priceUsd: number | null;
  billingType: BillingType;
  /** True when no price is published for this band. */
  customPricingOnly: boolean;
  approvalStatus: ApprovalStatus;
  /** ISO date this row was last confirmed. */
  effectiveDate: string;
  /** false = suppress this tier entirely across public surfaces. */
  active: boolean;
}

const EFFECTIVE = "2026-08-30";

export const PRICING_PACKAGES: readonly PricingPackage[] = [
  {
    id: "pilot",
    name: "Pilot — Single Position",
    description: "A focused engagement to fill one open role.",
    minPositions: 1,
    maxPositions: 1,
    priceUsd: PRICE_PILOT_USD,
    billingType: "one-time-flat",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "growth",
    name: PACKAGE_10.capacityLabel,
    description: "Several roles running in parallel.",
    minPositions: 2,
    maxPositions: PACKAGE_10.capacity,
    priceUsd: PACKAGE_10.totalUsd,
    billingType: "package",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "scale",
    name: PACKAGE_20.capacityLabel,
    description: "Concurrent hiring across functions.",
    minPositions: PACKAGE_10.capacity + 1,
    maxPositions: PACKAGE_20.capacity,
    priceUsd: PACKAGE_20.totalUsd,
    billingType: "package",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "volume",
    name: PACKAGE_30.capacityLabel,
    description: "Portfolio hiring in one package.",
    minPositions: PACKAGE_20.capacity + 1,
    maxPositions: PACKAGE_30.capacity,
    priceUsd: PACKAGE_30.totalUsd,
    billingType: "package",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "portfolio",
    name: PACKAGE_40.capacityLabel,
    description: "Portfolio hiring across business units.",
    minPositions: PACKAGE_30.capacity + 1,
    maxPositions: PACKAGE_40.capacity,
    priceUsd: PACKAGE_40.totalUsd,
    billingType: "package",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "program",
    name: PACKAGE_100.capacityLabel,
    description: "A continuous hiring programme in one package.",
    minPositions: PACKAGE_40.capacity + 1,
    maxPositions: PACKAGE_100.capacity,
    priceUsd: PACKAGE_100.totalUsd,
    billingType: "package",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "above-max",
    name: `More than ${MAX_POSITIONS} positions`,
    description: "Above the published maximum, the next step is to talk to us.",
    minPositions: MAX_POSITIONS + 1,
    maxPositions: null,
    priceUsd: null,
    billingType: "custom",
    customPricingOnly: true,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
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
  positions:            { min: 1,      max: MAX_POSITIONS, step: 1 },
  agencyFeePct:         { min: 0.10,   max: 0.30,  step: 0.01 },
  averageSalaryUsd:     { min: 40_000, max: 250_000, step: 5_000 },
  recruiterHourlyUsd:   { min: 20,     max: 150,   step: 5 },
  sourcingHoursPerRole: { min: 5,      max: 80,    step: 5 },
} as const;

export const CALCULATOR_DISCLAIMER =
  "Estimates are directional and depend on role volume, salary, package, hiring complexity, and client context. Based on SHRM & Ashby 2025 benchmarks.";

/**
 * Calculator presets — one-click assumption bundles.
 * Presets only change input assumptions; the TaaSFlow total always comes from
 * `positionsTotalUsd()`.
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
    inputs: { positions: 20, averageSalaryUsd: 80_000, agencyFeePct: 0.18, recruiterHourlyUsd: 40, sourcingHoursPerRole: 20 },
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

/** True iff a numeric price is published for this band. */
export function isTierPricePublic(pkg: PricingPackage): boolean {
  return (
    pkg.active &&
    pkg.approvalStatus === "approved" &&
    !pkg.customPricingOnly &&
    pkg.priceUsd !== null
  );
}

/** Exact final total for a position count. null above the maximum. */
export function totalForPositions(positions: number): number | null {
  return positionsTotalUsd(positions);
}

/** USD, exact, never abbreviated. */
export function formatUsd(value: number): string {
  return formatUsdExact(value);
}
