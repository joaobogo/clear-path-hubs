/**
 * The single source of truth for service-commitment wording and for measured
 * performance against those commitments.
 *
 * Two surfaces report the same promises — the Overview scorecard ("Our
 * commitments to you") and the Account plan table ("Service commitments").
 * They used to word the same stored number differently ("within 1 working day"
 * vs "within 24h") and measure it with two unrelated formulas, so the same
 * account could read "Missed (62 hours average)" on one page and "Not measured"
 * on the other. Both now take their names, targets and results from here.
 *
 * Pure: no DB, no network, no clock beyond what is passed in.
 */
import { roundHalf, varianceLabel, type RoleSla, type SlaMetric } from "@/lib/sla";

export type CommitmentKey = SlaMetric["key"];

/** Canonical commitment names. Never re-worded per surface. */
export const COMMITMENT_LABEL: Record<CommitmentKey, string> = {
  first_candidate: "First candidate",
  full_shortlist: "Shortlist",
  interview_slots: "Interview slots",
};

/** Canonical target wording, built from the stored commitment numbers. */
export function firstCandidatePromise(days: number): string {
  return `Within ${days} ${days === 1 ? "day" : "days"} of launch`;
}

export function shortlistLabel(size: number): string {
  return `Shortlist of ${size}`;
}

export function shortlistPromise(size: number, days: number): string {
  return `${size} ${size === 1 ? "candidate" : "candidates"} within ${days} ${
    days === 1 ? "day" : "days"
  }`;
}

/**
 * Hours are stated in hours on every surface. The plan page used to translate
 * 24h into "1 working day", which read as a different (softer) promise.
 */
export function interviewSlotsPromise(hours: number): string {
  return `Interview slots within ${hours}h of a request`;
}

/** A target that differs across the account's roles is stated as a range. */
export function rangeOf(values: number[]): { min: number; max: number } | null {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  return { min: clean[0]!, max: clean[clean.length - 1]! };
}

export type CommitmentRollup = {
  /** Roles carrying this commitment. */
  roles: number;
  /** Commitments whose outcome is known (met or missed). */
  measured: number;
  met: number;
  /** Average signed variance across measured roles, in the metric's unit. */
  averageVariance: number | null;
  varianceUnit: SlaMetric["varianceUnit"];
  /** One-line measured result, or null when nothing has come due yet. */
  performance: string | null;
  /** Why there is no result, or the sample the result is drawn from. */
  note: string;
};

/** Said when a commitment exists but no role has reached its deadline yet. */
export const NOTHING_DUE_YET = "No role has reached this deadline yet";

function plural(n: number, one: string) {
  return n === 1 ? one : `${one}s`;
}

/**
 * Aggregates the per-role SLA metrics the Overview shows into one line per
 * commitment, so the plan table reports the same outcomes rather than its own.
 */
export function rollupCommitments(roles: RoleSla[]): Record<CommitmentKey, CommitmentRollup> {
  const keys: CommitmentKey[] = ["first_candidate", "full_shortlist", "interview_slots"];
  const out = {} as Record<CommitmentKey, CommitmentRollup>;

  for (const key of keys) {
    const metrics = roles
      .map((r) => r.metrics.find((m) => m.key === key))
      .filter((m): m is SlaMetric => !!m);
    const decided = metrics.filter((m) => m.state === "met" || m.state === "missed");
    const met = decided.filter((m) => m.state === "met").length;
    const variances = decided
      .map((m) => m.varianceValue)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const unit = metrics[0]?.varianceUnit ?? "days";
    const averageVariance = variances.length
      ? variances.reduce((s, v) => s + v, 0) / variances.length
      : null;

    let performance: string | null = null;
    let note = NOTHING_DUE_YET;
    if (decided.length > 0) {
      const headline =
        met === decided.length
          ? `Met on ${decided.length} of ${decided.length} ${plural(decided.length, "role")}`
          : `Met on ${met} of ${decided.length} ${plural(decided.length, "role")}`;
      
      // Shared detail computation for both Overview and Plan & Billing
      const varianceText =
        averageVariance === null || Math.abs(roundHalf(averageVariance)) < 0.1
          ? null
          : `${varianceLabel(averageVariance, unit)} on average`;
      
      performance = varianceText ? `${headline} · ${varianceText}` : headline;
      note = `Measured across ${decided.length} ${plural(decided.length, "role")} on this plan`;
    } else if (metrics.some(m => m.state === "at_risk")) {
      performance = "At risk";
      note = "We owe you movement";
    }

    out[key] = {
      roles: metrics.length,
      measured: decided.length,
      met,
      averageVariance,
      varianceUnit: unit,
      performance,
      note,
    };
  }

  return out;
}
