/**
 * Service commitments: the promise, the actual, and the variance.
 *
 * At role launch we state a number ("first shortlist in 5 days"). This module
 * turns those numbers into measurable outcomes so the dashboard can report
 * against our own promise — including when we miss it.
 */

export type SlaState = "met" | "missed" | "on_track" | "at_risk" | "pending";

export type SlaMetric = {
  key: "first_candidate" | "full_shortlist" | "interview_slots";
  label: string;
  /** Plain-language statement of the promise. */
  promise: string;
  /** Deadline we committed to, when the clock has started. */
  dueAt: string | null;
  /** When we actually delivered, if we have. */
  actualAt: string | null;
  /** Plain-language actual, e.g. "4 days" or "not yet". */
  actual: string;
  /** Numeric actual value for aggregation, in the same unit as varianceUnit. */
  actualValue: number | null;
  /** Signed days (or hours for hour-based metrics). Negative = ahead. */
  varianceValue: number | null;
  varianceUnit: "days" | "hours";
  variance: string;
  state: SlaState;
};

export type RoleSla = {
  positionId: string;
  title: string;
  status: string;
  baselineAt: string;
  metrics: SlaMetric[];
  /** Worst state across metrics — drives the role's badge. */
  state: SlaState;
};

export type SlaSummary = {
  /** Commitments whose outcome is known (met or missed). */
  measured: number;
  /** Commitments tracked across all displayed roles, including pending/on-track rows. */
  total: number;
  met: number;
  /** Whole-number percentage of measured commitments met, null when none. */
  onTimeRate: number | null;
  /** Average signed variance in days across every measured commitment (hours converted to days). */
  averageVarianceDays: number | null;
  atRisk: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function diffDays(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
}

export function diffHours(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / HOUR_MS;
}

export function roundHalf(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "2 days early" / "1.5 days late" / "on time" */
export function varianceLabel(value: number | null, unit: "days" | "hours"): string {
  if (value === null) return "—";
  const v = roundHalf(value);
  if (Math.abs(v) < 0.1) return "on time";
  const noun = unit === "days" ? "day" : "hour";
  const n = Math.abs(v);
  const plural = n === 1 ? noun : `${noun}s`;
  return v < 0 ? `${n} ${plural} early` : `${n} ${plural} late`;
}

export function amountLabel(value: number | null, unit: "days" | "hours"): string {
  if (value === null) return "not yet";
  const v = roundHalf(Math.max(value, 0));
  const noun = unit === "days" ? "day" : "hour";
  return `${v} ${v === 1 ? noun : `${noun}s`}`;
}

/**
 * Outcome of one commitment. `deliveredAt` null means still open, in which
 * case we compare the deadline to now to say whether we're on track.
 */
export function evaluate(
  dueAt: string,
  deliveredAt: string | null,
  now: number = Date.now(),
): { state: SlaState; variance: number | null } {
  const due = new Date(dueAt).getTime();
  if (deliveredAt) {
    const delivered = new Date(deliveredAt).getTime();
    return { state: delivered <= due ? "met" : "missed", variance: delivered - due };
  }
  if (now > due) return { state: "missed", variance: now - due };
  // Inside the last 20% of the window with nothing delivered yet.
  return { state: "on_track", variance: null };
}

export function worstState(states: SlaState[]): SlaState {
  const order: SlaState[] = ["missed", "at_risk", "pending", "on_track", "met"];
  for (const s of order) if (states.includes(s)) return s;
  return "pending";
}

export const SLA_STATE_LABEL: Record<SlaState, string> = {
  met: "Met",
  missed: "Missed",
  on_track: "On track",
  at_risk: "At risk",
  pending: "Not started",
};
