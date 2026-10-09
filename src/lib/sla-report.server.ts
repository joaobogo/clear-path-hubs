/**
 * Pure computation for SLA reporting (promise vs actual vs variance).
 * Kept out of the server-function module so code splitting stays safe.
 */
import {
  amountLabel,
  diffDays,
  diffHours,
  evaluate,
  varianceLabel,
  worstState,
  type RoleSla,
  type SlaMetric,
  type SlaState,
  type SlaSummary,
} from "@/lib/sla";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function emptySummary(): SlaSummary {
  return { measured: 0, total: 0, met: 0, onTimeRate: null, averageVarianceDays: null, atRisk: 0 };
}

export function dayMetric(args: {
  key: SlaMetric["key"];
  label: string;
  promise: string;
  baselineAt: string;
  dueAt: string;
  actualAt: string | null;
  now: number;
}): SlaMetric {
  const { state, variance } = evaluate(args.dueAt, args.actualAt, args.now);
  const varianceDays = variance === null ? null : variance / (24 * 60 * 60 * 1000);
  const elapsedDays = args.actualAt ? diffDays(args.baselineAt, args.actualAt) : null;
  return {
    key: args.key,
    label: args.label,
    promise: args.promise,
    dueAt: args.dueAt,
    actualAt: args.actualAt,
    actual: elapsedDays === null ? "not yet" : elapsedDays === 0 ? "Same day as launch" : amountLabel(elapsedDays, "days"),
    actualValue: elapsedDays,
    varianceValue: varianceDays,
    varianceUnit: "days",
    variance: varianceLabel(varianceDays, "days"),
    state,
  };
}

export function summarise(roles: RoleSla[]): SlaSummary {
  let total = 0;
  let measured = 0;
  let met = 0;
  let atRisk = 0;
  const variances: number[] = [];
  for (const role of roles) {
    for (const m of role.metrics) {
      total += 1;
      // P39 Fix: Include every measured commitment (met OR missed) in the population
      // for average variance.
      if (m.state === "met" || m.state === "missed") {
        measured += 1;
        if (m.state === "met") met += 1;

        if (m.varianceValue !== null && Number.isFinite(m.varianceValue)) {
          const inDays = m.varianceUnit === "hours" ? m.varianceValue / 24 : m.varianceValue;
          variances.push(inDays);
        }
      }
      if (m.state === "at_risk" || m.state === "missed") atRisk += 1;
    }
  }
  return {
    total,
    measured,
    met,
    onTimeRate: measured ? Math.round((met / measured) * 100) : null,
    averageVarianceDays: variances.length
      ? variances.reduce((s, v) => s + v, 0) / variances.length
      : null,
    atRisk,
  };
}
