/**
 * What TaaSFlow owes this client, in a table they can point to.
 *
 * Every row here comes from something stored against the account: a plan
 * entitlement, a subscription, or a `position_commitments` row attached to one
 * of their roles. Marketing copy is not a source. If a commitment is not
 * stored, its row does not appear — a client should never read a promise here
 * that their contract does not contain.
 *
 * Names, targets and measured results all come from the one canonical
 * commitments source (`@/lib/commitments/canonical`), which the Overview
 * scorecard also reads. The two surfaces cannot word the same stored number
 * differently or report different outcomes for it.
 *
 * Pure. No DB access, no network, no clock beyond what is passed in.
 */

import {
  COMMITMENT_LABEL,
  firstCandidatePromise,
  interviewSlotsPromise,
  rangeOf,
  shortlistLabel,
  shortlistPromise,
  type CommitmentKey,
  type CommitmentRollup,
} from "@/lib/commitments/canonical";

/** Shown when a commitment simply is not measurable from account data. */
export const NOT_MEASURED = "Not measured from your account data";

/** Said when the account has no stored plan or commitments at all. */
export const PLAN_BEING_SET_UP = "Your plan is being set up";

/** Closing line: guards against reading absence as an unstated promise. */
export const SCOPE_FOOTNOTE =
  "This table lists everything your current plan commits to. Anything not listed here is not included.";

export type StoredPlan = {
  label: string | null;
  /** Roles the plan covers, or null when the plan is unlimited. */
  rolesTotal: number | null;
  rolesUsed: number;
  source: "package" | "subscription" | null;
  /** ISO date the allowance runs out, when the plan has one. */
  expiresAt: string | null;
};

/** One stored commitment row, attached to one of the client's roles. */
export type StoredRoleCommitment = {
  positionId: string;
  firstShortlistDays: number;
  shortlistSize: number;
  interviewSlotsHours: number;
};

export type ExpectationRow = {
  key: CommitmentKey | "included_roles" | "plan_term";
  /** What the commitment is called, in the client's words. */
  commitment: string;
  /** Exactly what is stored, never rounded up into a claim. */
  promised: string;
  /** Measured performance, or null when we are not showing one. */
  performance: string | null;
  /** Why there is no figure, or the sample the figure is drawn from. */
  sampleNote: string;
};

export type ServiceExpectations = {
  /** False when nothing is stored yet — the page shows the empty state. */
  hasPlan: boolean;
  planLabel: string | null;
  rows: ExpectationRow[];
  footnote: string;
  /** Roles with a stored commitment, so the client can see the basis. */
  commitmentRoleCount: number;
};

function plural(n: number, one: string, many = `${one}s`) {
  return n === 1 ? one : many;
}

/** "8 days", or a range when the account's roles carry different terms. */
export function spread(values: number[], unit: (n: number) => string): string | null {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  const min = clean[0]!;
  const max = clean[clean.length - 1]!;
  return min === max ? unit(min) : `${min}–${max} ${unit(max).replace(/^\d+\s*/, "")}`;
}

export function hoursLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} working ${plural(days, "day")}`;
  }
  return `${hours} ${plural(hours, "hour")}`;
}

/** Canonical target wording, widened to a range when roles differ. */
function targetFor(values: number[], one: (n: number) => string): string | null {
  const r = rangeOf(values);
  if (!r) return null;
  if (r.min === r.max) return one(r.min);
  // Keep the canonical sentence, state the spread inside it.
  return one(r.max).replace(String(r.max), `${r.min}–${r.max}`);
}

export function buildServiceExpectations(input: {
  plan: StoredPlan | null;
  commitments: StoredRoleCommitment[];
  /** Measured outcomes from the shared commitments rollup, when available. */
  measured?: Record<CommitmentKey, CommitmentRollup> | null;
}): ServiceExpectations {
  const { plan, commitments, measured } = input;
  const rows: ExpectationRow[] = [];

  const days = commitments.map((c) => Number(c.firstShortlistDays));
  const sizes = commitments.map((c) => Number(c.shortlistSize));
  const hours = commitments.map((c) => Number(c.interviewSlotsHours));

  const result = (key: CommitmentKey) => ({
    performance: measured?.[key]?.performance ?? null,
    sampleNote: measured?.[key]?.note ?? NOT_MEASURED,
  });

  const firstTarget = targetFor(days, firstCandidatePromise);
  if (firstTarget) {
    rows.push({
      key: "first_candidate",
      commitment: COMMITMENT_LABEL.first_candidate,
      promised: firstTarget,
      ...result("first_candidate"),
    });
  }

  const sizeRange = rangeOf(sizes);
  const dayRange = rangeOf(days);
  if (sizeRange && dayRange) {
    rows.push({
      key: "full_shortlist",
      commitment:
        sizeRange.min === sizeRange.max
          ? shortlistLabel(sizeRange.min)
          : COMMITMENT_LABEL.full_shortlist,
      promised:
        sizeRange.min === sizeRange.max && dayRange.min === dayRange.max
          ? shortlistPromise(sizeRange.min, dayRange.min)
          : shortlistPromise(sizeRange.max, dayRange.max)
              .replace(String(sizeRange.max), `${sizeRange.min}–${sizeRange.max}`)
              .replace(
                `within ${dayRange.max}`,
                `within ${dayRange.min === dayRange.max ? dayRange.max : `${dayRange.min}–${dayRange.max}`}`,
              ),
      ...result("full_shortlist"),
    });
  }

  const hoursTarget = targetFor(hours, interviewSlotsPromise);
  if (hoursTarget) {
    rows.push({
      key: "interview_slots",
      commitment: COMMITMENT_LABEL.interview_slots,
      promised: hoursTarget,
      ...result("interview_slots"),
    });
  }

  if (plan && (plan.rolesTotal !== null || plan.label)) {
    const total = plan.rolesTotal;
    const promised =
      total === null
        ? "Unlimited roles while the plan runs"
        : plan.source === "subscription"
          ? `Up to ${total} active ${plural(total, "role")} at a time`
          : `${total} ${plural(total, "role")} included`;
    rows.push({
      key: "included_roles",
      commitment: "Roles included",
      promised,
      performance:
        total === null ? null : `${plan.rolesUsed} of ${total} used so far`,
      sampleNote: total === null ? NOT_MEASURED : "From your plan record",
    });
  }

  if (plan?.expiresAt) {
    const d = new Date(plan.expiresAt);
    if (!Number.isNaN(d.getTime())) {
      rows.push({
        key: "plan_term",
        commitment: plan.source === "subscription" ? "Renews on" : "Allowance valid until",
        promised: d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
        performance: null,
        sampleNote: "From your plan record",
      });
    }
  }

  return {
    hasPlan: rows.length > 0,
    planLabel: plan?.label ?? null,
    rows,
    footnote: SCOPE_FOOTNOTE,
    commitmentRoleCount: commitments.length,
  };
}
