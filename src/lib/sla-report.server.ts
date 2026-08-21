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

/**
 * Average turnaround from an interview request to slots being offered. Only
 * interviews where slots actually went out (or a time was booked) count as
 * measured; the rest are open requests still on our clock.
 */
export function interviewSlotMetric(interviews: AnyRow[], hours: number, now: number): SlaMetric {
  const promise = `Interview slots within ${hours}h of a request`;
  const measured: number[] = [];
  const states: SlaState[] = [];
  let lastActualAt: string | null = null;

  for (const iv of interviews) {
    const requestedAt = (iv.requested_at ?? iv.created_at) as string | null;
    if (!requestedAt) continue;
    const hasSlots =
      (Array.isArray(iv.proposed_times) && iv.proposed_times.length > 0) || !!iv.scheduled_at;
    const respondedAt = hasSlots ? ((iv.updated_at ?? iv.scheduled_at) as string | null) : null;
    const dueAt = new Date(new Date(requestedAt).getTime() + hours * 60 * 60 * 1000).toISOString();
    const { state } = evaluate(dueAt, respondedAt, now);
    states.push(state);
    if (respondedAt) {
      measured.push(Math.max(diffHours(requestedAt, respondedAt), 0));
      if (!lastActualAt || respondedAt > lastActualAt) lastActualAt = respondedAt;
    }
  }

  if (states.length === 0) {
    return {
      key: "interview_slots",
      label: "Interview slots",
      promise,
      dueAt: null,
      actualAt: null,
      actual: "no requests yet",
      actualValue: null,
      varianceValue: null,
      varianceUnit: "hours",
      variance: "—",
      state: "pending",
    };
  }

  const avg = measured.length ? measured.reduce((s, v) => s + v, 0) / measured.length : null;
  return {
    key: "interview_slots",
    label: "Interview slots",
    promise,
    dueAt: null,
    actualAt: lastActualAt,
    actual: avg === null ? "waiting on us" : `${amountLabel(avg, "hours")} average`,
    actualValue: avg,
    varianceValue: avg === null ? null : avg - hours,
    varianceUnit: "hours",
    variance: avg === null ? "—" : varianceLabel(avg - hours, "hours"),
    state: worstState(states),
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
