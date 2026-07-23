/**
 * TaaSFlow ROI Calculator — pure calculation module.
 * Single source of truth for calculator math. UI must not duplicate
 * these formulas. See docs/migration/calculator-behavior.md.
 */

import {
  selectPackage,
  isTierPricePublic,
  type PricingPackage,
} from "@/config/public-pricing";

export interface CalculatorInputs {
  positions: number;
  averageSalaryUsd: number;
  agencyFeePct: number; // 0..1
  recruiterHourlyUsd: number;
  sourcingHoursPerRole: number;
}

export interface CalculatorResult {
  inputs: CalculatorInputs;
  agencyCostUsd: number;
  internalSourcingCostUsd: number;
  traditionalCostUsd: number;
  taasflowCostUsd: number | null; // null => custom / quote
  taasflowPackage: PricingPackage | null;
  isCustomPricing: boolean;
  /** Traditional − TaaSFlow. null when custom pricing. */
  projectedSavingsUsd: number | null;
  /** Fraction 0..1. null when custom pricing or traditional cost is 0. */
  projectedReductionPct: number | null;
  /** True when savings are ≤ 0 (assumptions do not show a reduction). */
  hasNegativeSavings: boolean;
}

export function computeRoi(inputs: CalculatorInputs): CalculatorResult {
  const positions = Math.max(0, Math.round(inputs.positions));
  const salary = Math.max(0, inputs.averageSalaryUsd);
  const feePct = Math.max(0, inputs.agencyFeePct);
  const hourly = Math.max(0, inputs.recruiterHourlyUsd);
  const hours = Math.max(0, inputs.sourcingHoursPerRole);

  const agencyCostUsd = positions * salary * feePct;
  const internalSourcingCostUsd = positions * hourly * hours;
  const traditionalCostUsd = agencyCostUsd + internalSourcingCostUsd;

  const pkg = selectPackage(positions);
  const canShowPrice = pkg ? isTierPricePublic(pkg) : false;
  const isCustomPricing = !pkg || !canShowPrice;
  const taasflowCostUsd = pkg && canShowPrice ? (pkg.priceUsd as number) : null;

  const projectedSavingsUsd =
    taasflowCostUsd == null ? null : traditionalCostUsd - taasflowCostUsd;

  const projectedReductionPct =
    projectedSavingsUsd == null || traditionalCostUsd <= 0
      ? null
      : projectedSavingsUsd / traditionalCostUsd;

  return {
    inputs: { positions, averageSalaryUsd: salary, agencyFeePct: feePct, recruiterHourlyUsd: hourly, sourcingHoursPerRole: hours },
    agencyCostUsd,
    internalSourcingCostUsd,
    traditionalCostUsd,
    taasflowCostUsd,
    taasflowPackage: pkg,
    isCustomPricing,
    projectedSavingsUsd,
    projectedReductionPct,
    hasNegativeSavings: projectedSavingsUsd != null && projectedSavingsUsd <= 0,
  };
}
