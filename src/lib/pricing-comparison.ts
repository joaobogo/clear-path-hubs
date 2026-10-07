/**
 * Pricing comparison — the pure math behind the public cost calculator.
 *
 * Rules this file enforces:
 *   - Both sides cover the SAME hires over the SAME period.
 *   - The TaaSFlow side is always the total of the package that covers the
 *     positions (`packageForPositions`), never a per-position figure.
 *   - A negative difference is a real answer and is returned as one.
 *   - Internal recruiter time is not part of the headline: it is neither
 *     removed nor added, so it can never be counted on both sides.
 *   - Above the maximum package there is no price, so no difference.
 *   - Nothing here reads, stores or sends the inputs anywhere.
 */
import {
  ABOVE_MAX_ROLES_LABEL,
  formatUsdExact,
  packageForPositions,
} from "@/config/pricing-core";
import { CALCULATOR_DEFAULTS } from "@/config/public-pricing";

export type ComparisonMode = "project" | "recurring";

export const MAX_COMPARISON_MONTHS = 60;

/** Every default is an editable example, not an industry fact. */
export const COMPARISON_DEFAULTS = {
  mode: "project" as ComparisonMode,
  hires: 3,
  positions: 3,
  agencyFeePct: CALCULATOR_DEFAULTS.agencyFeePct * 100,
  salaryUsd: CALCULATOR_DEFAULTS.averageSalaryUsd,
  months: 12,
} as const;

export const DEFAULT_LABEL = "Editable example, not an industry fact";

export type ComparisonInput = {
  mode: ComparisonMode;
  /** Hires made in the period. */
  hires: number;
  /**
   * Positions open at the same time, which decides the package. Project mode
   * ignores it and uses `hires`.
   */
  positions?: number;
  agencyFeePct: number;
  salaryUsd: number;
  /** Recurring mode only: months of the subscription. */
  months?: number;
};

export type ComparisonResult =
  | { status: "invalid"; problems: string[] }
  | {
      status: "quote-only";
      mode: ComparisonMode;
      hires: number;
      positions: number;
      agencyTotalUsd: number;
      explanation: string;
      formula: string;
      assumptions: string[];
    }
  | {
      status: "ok";
      mode: ComparisonMode;
      hires: number;
      positions: number;
      months: number;
      packageLabel: string;
      agencyTotalUsd: number;
      taasTotalUsd: number;
      /** Agency minus TaaSFlow. Positive: TaaSFlow costs less. Negative: more. */
      differenceUsd: number;
      direction: "taasflow-lower" | "taasflow-higher" | "equal";
      explanation: string;
      formula: string;
      assumptions: string[];
    };

const isWhole = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n);

export function compareCosts(input: ComparisonInput): ComparisonResult {
  const problems: string[] = [];
  const { mode, hires, agencyFeePct, salaryUsd } = input;

  if (!isWhole(hires) || hires < 1) problems.push("Hires must be a whole number of at least 1.");
  const positions = mode === "recurring" ? (input.positions ?? hires) : hires;
  if (mode === "recurring" && (!isWhole(positions) || positions < 1)) {
    problems.push("Positions open at once must be a whole number of at least 1.");
  }
  if (typeof salaryUsd !== "number" || !Number.isFinite(salaryUsd) || salaryUsd <= 0) {
    problems.push("Average salary must be more than $0.");
  }
  if (
    typeof agencyFeePct !== "number" ||
    !Number.isFinite(agencyFeePct) ||
    agencyFeePct < 0 ||
    agencyFeePct > 100
  ) {
    problems.push("Agency fee must be between 0% and 100%.");
  }
  const months = mode === "recurring" ? input.months : 1;
  if (mode === "recurring" && (!isWhole(months) || months < 1 || months > MAX_COMPARISON_MONTHS)) {
    problems.push(`Months must be a whole number from 1 to ${MAX_COMPARISON_MONTHS}.`);
  }
  if (problems.length > 0) return { status: "invalid", problems };

  const m = months as number;
  const agencyTotalUsd = Math.round(hires * salaryUsd * (agencyFeePct / 100));
  const pct = `${agencyFeePct}%`;
  const formula =
    mode === "project"
      ? "Agency fees = hires × average salary × agency fee percentage. TaaSFlow = the total of the one package that covers those positions, paid once. Difference = agency fees minus the TaaSFlow total."
      : "Agency fees = hires × average salary × agency fee percentage. TaaSFlow = the monthly package total × the number of months. Difference = agency fees minus the TaaSFlow total.";
  const assumptions = [
    `${hires} ${hires === 1 ? "hire" : "hires"} at ${formatUsdExact(salaryUsd)} average salary and a ${pct} agency fee (${DEFAULT_LABEL.toLowerCase()}).`,
    mode === "project"
      ? "One hiring project: the TaaSFlow package is paid once."
      : `${m} ${m === 1 ? "month" : "months"} of a monthly package, before any annual-prepay discount.`,
    "Internal recruiter time is left out on both sides.",
  ];

  const pkg = packageForPositions(positions);
  if (!pkg) {
    return {
      status: "quote-only",
      mode,
      hires,
      positions,
      agencyTotalUsd,
      explanation: `${ABOVE_MAX_ROLES_LABEL} are scoped with your account team, so there is no TaaSFlow price to compare. Agency fees for these hires would be ${formatUsdExact(agencyTotalUsd)} at the inputs above.`,
      formula,
      assumptions,
    };
  }

  const taasTotalUsd = mode === "project" ? pkg.totalUsd : pkg.totalUsd * m;
  const differenceUsd = agencyTotalUsd - taasTotalUsd;
  const direction =
    differenceUsd > 0 ? "taasflow-lower" : differenceUsd < 0 ? "taasflow-higher" : "equal";
  const period = mode === "project" ? "for this project" : `over ${m} ${m === 1 ? "month" : "months"}`;
  const explanation =
    direction === "taasflow-lower"
      ? `On these inputs, ${pkg.capacityLabel.toLowerCase()} at ${formatUsdExact(taasTotalUsd)} costs ${formatUsdExact(differenceUsd)} less than agency fees of ${formatUsdExact(agencyTotalUsd)} ${period}.`
      : direction === "taasflow-higher"
        ? `On these inputs, ${pkg.capacityLabel.toLowerCase()} at ${formatUsdExact(taasTotalUsd)} costs ${formatUsdExact(-differenceUsd)} more than agency fees of ${formatUsdExact(agencyTotalUsd)} ${period}. The cheaper option here is the agency.`
        : `On these inputs, both options cost ${formatUsdExact(agencyTotalUsd)} ${period}.`;

  return {
    status: "ok",
    mode,
    hires,
    positions,
    months: m,
    packageLabel: pkg.capacityLabel,
    agencyTotalUsd,
    taasTotalUsd,
    differenceUsd,
    direction,
    explanation,
    formula,
    assumptions,
  };
}

/** Signed USD for display: "$1,000 less", "$500 more". */
export function describeDifference(differenceUsd: number): string {
  if (differenceUsd === 0) return "No difference";
  return differenceUsd > 0
    ? `${formatUsdExact(differenceUsd)} less with TaaSFlow`
    : `${formatUsdExact(-differenceUsd)} more with TaaSFlow`;
}
