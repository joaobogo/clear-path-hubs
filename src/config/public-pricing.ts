/**
 * TaaSFlow — Calculator/selector shape for public pricing.
 * =======================================================
 * Every number here comes from src/config/pricing-core.ts, which holds the
 * only pricing rule: $699 for one position, then $900 (2–10), $850 (11–20),
 * $800 (21–30) per position, 30 maximum, monotonic total.
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
  POSITION_BANDS,
  GROWTH_RATE_USD,
  SCALE_RATE_USD,
  VOLUME_RATE_USD,
  positionsTotalUsd,
  formatUsdExact,
} from "@/config/pricing-core";

export type BillingType = "one-time-flat" | "per-position" | "custom";
export type ApprovalStatus = "approved" | "pending" | "review";

export interface PricingPackage {
  /** Machine identifier used in analytics, tests, and internal wiring. */
  id: "pilot" | "growth" | "scale" | "volume" | "above-max";
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
  /** Per-position rate in USD for banded tiers. null for pilot / above max. */
  ratePerPositionUsd: number | null;
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
    minPositions: POSITION_BANDS.pilot.min,
    maxPositions: POSITION_BANDS.pilot.max,
    priceUsd: PRICE_PILOT_USD,
    ratePerPositionUsd: null,
    billingType: "one-time-flat",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "growth",
    name: "2 to 10 positions",
    description: "Several roles running in parallel.",
    minPositions: POSITION_BANDS.growth.min,
    maxPositions: POSITION_BANDS.growth.max,
    priceUsd: null,
    ratePerPositionUsd: GROWTH_RATE_USD,
    billingType: "per-position",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "scale",
    name: "11 to 20 positions",
    description: "Concurrent hiring across functions.",
    minPositions: POSITION_BANDS.scale.min,
    maxPositions: POSITION_BANDS.scale.max,
    priceUsd: null,
    ratePerPositionUsd: SCALE_RATE_USD,
    billingType: "per-position",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "volume",
    name: "21 to 30 positions",
    description: "Portfolio hiring at the lowest published rate.",
    minPositions: POSITION_BANDS.volume.min,
    maxPositions: POSITION_BANDS.volume.max,
    priceUsd: null,
    ratePerPositionUsd: VOLUME_RATE_USD,
    billingType: "per-position",
    customPricingOnly: false,
    approvalStatus: "approved",
    effectiveDate: EFFECTIVE,
    active: true,
  },
  {
    id: "above-max",
    name: `More than ${MAX_POSITIONS} positions`,
    description: "Above the published maximum we scope it with you.",
    minPositions: POSITION_BANDS.aboveMax.min,
    maxPositions: POSITION_BANDS.aboveMax.max,
    priceUsd: null,
    ratePerPositionUsd: null,
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
    (pkg.priceUsd !== null || pkg.ratePerPositionUsd !== null)
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
