/**
 * What TaaSFlow owes this client, in a table they can point to.
 *
 * Every row here comes from something stored against the account: a plan
 * entitlement, a subscription, or a `position_commitments` row attached to one
 * of their roles. Marketing copy is not a source. If a commitment is not
 * stored, its row does not appear — a client should never read a promise here
 * that their contract does not contain.
 *
 * Performance figures sit beside a commitment only when we can measure them
 * from completed roles, and only from two or more. One role is an anecdote, not
 * a track record, so it is suppressed rather than averaged. No figure is ever
 * compared against other clients.
 *
 * Pure. No DB access, no network, no clock beyond what is passed in.
 */

/** Below this many completed roles, we say so instead of showing a number. */
export const MIN_PERFORMANCE_SAMPLE = 2;

/** Shown in place of a performance figure when the sample is too small. */
export const NOT_ENOUGH_SAMPLE = "Not enough completed roles to show this yet";

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

/**
 * A role that has finished, with what was promised and what happened.
 * `actual*` is null when the outcome was never recorded — those roles are
 * excluded from the sample rather than counted as a miss.
 */
export type CompletedRoleOutcome = {
  positionId: string;
  promisedShortlistDays: number;
  actualShortlistDays: number | null;
  promisedShortlistSize: number;
  actualShortlistSize: number | null;
};

export type ExpectationRow = {
  key: "first_shortlist" | "shortlist_size" | "response_time" | "included_roles" | "plan_term";
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

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "delivered in 8 days on your last 2 completed roles", or the honest refusal. */
export function performanceFor(
  samples: number[],
  render: (avg: string, n: number) => string,
): { performance: string | null; sampleNote: string } {
  if (samples.length < MIN_PERFORMANCE_SAMPLE) {
    return {
      performance: null,
      sampleNote: NOT_ENOUGH_SAMPLE,
    };
  }
  const n = samples.length;
  return {
    performance: render(round1(average(samples)), n),
    sampleNote: `Measured across your last ${n} completed ${plural(n, "role")}`,
  };
}

export function buildServiceExpectations(input: {
  plan: StoredPlan | null;
  commitments: StoredRoleCommitment[];
  completed: CompletedRoleOutcome[];
}): ServiceExpectations {
  const { plan, commitments, completed } = input;
  const rows: ExpectationRow[] = [];

  const shortlistDays = spread(
    commitments.map((c) => Number(c.firstShortlistDays)),
    (n) => `${n} ${plural(n, "day")}`,
  );
  if (shortlistDays) {
    const samples = completed
      .map((c) => c.actualShortlistDays)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
    const perf = performanceFor(
      samples,
      (avg, n) => `Delivered in ${avg} ${plural(Number(avg), "day")} on your last ${n} completed ${plural(n, "role")}`,
    );
    rows.push({
      key: "first_shortlist",
      commitment: "First shortlist window",
      promised: `Within ${shortlistDays} of the brief being confirmed`,
      ...perf,
    });
  }

  const sizes = spread(
    commitments.map((c) => Number(c.shortlistSize)),
    (n) => `${n} ${plural(n, "candidate")}`,
  );
  if (sizes) {
    const samples = completed
      .map((c) => c.actualShortlistSize)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0);
    const perf = performanceFor(
      samples,
      (avg, n) => `${avg} ${plural(Number(avg), "candidate")} on your last ${n} completed ${plural(n, "role")}`,
    );
    rows.push({
      key: "shortlist_size",
      commitment: "Candidates per shortlist",
      promised: sizes,
      ...perf,
    });
  }

  const responseHours = spread(
    commitments.map((c) => Number(c.interviewSlotsHours)),
    (n) => hoursLabel(n),
  );
  if (responseHours) {
    rows.push({
      key: "response_time",
      commitment: "Interview slots offered within",
      promised: `${responseHours} of your decision`,
      performance: null,
      sampleNote: NOT_MEASURED,
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
