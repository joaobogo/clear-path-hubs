// "At risk" signal for a role — derived ONLY from real timing data we hold.
//
// RULES:
//  - Never guess. A role is only flagged when a date proves it.
//  - One sentence, plain language, no internal state names.
//  - Pure module: safe on server and client.

export type RoleRiskInput = {
  /** Position status (active | approved | paused | closed | draft ...). */
  status: string;
  /** Most recent real movement on the role (stage change, delivery, interview). */
  lastMovementAt?: string | null;
  /** Candidates delivered and still waiting on a client decision. */
  awaitingDecision?: number;
  /** When the oldest of those was delivered. */
  oldestAwaitingDecisionAt?: string | null;
  /** When the oldest unconfirmed interview request was made. */
  oldestInterviewToConfirmAt?: string | null;
  /** True when an interview is requested but no time is confirmed. */
  interviewsToConfirm?: number;
  /** The date we promised a first shortlist by, when a commitment exists. */
  promisedShortlistBy?: string | null;
  /** Whether a shortlist has actually been delivered. */
  shortlistDeliveredAt?: string | null;
};

export type RoleRisk = {
  atRisk: boolean;
  /** One sentence explaining the flag. Empty when not at risk. */
  reason: string;
  /** Machine key, for tests and analytics. */
  cause:
    | "none"
    | "stalled"
    | "waiting_on_client"
    | "interview_unscheduled"
    | "promise_missed";
};

/** Days a role may sit with no movement before we flag it. */
export const STALL_DAYS = 7;
/** Days a decision may sit with the client before we flag it. */
export const DECISION_WAIT_DAYS = 3;
/** Days an interview request may sit unconfirmed before we flag it. */
export const INTERVIEW_WAIT_DAYS = 2;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  // Use a precise difference. If it's less than 24h, it's 0 days.
  // We subtract 1ms to ensure that if it was exactly 24h ago, it's still 1 day,
  // but if it was 23h59m ago, it's 0 days.
  const diffMs = now.getTime() - t;
  return Math.max(0, Math.floor(diffMs / DAY_MS));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Render an age in honest units: hours when < 24h, otherwise whole days.
 * Never rounds up (e.g. 18 hours stays "18 hours ago", not "2 days ago").
 */
function honestAge(iso: string | null | undefined, now: Date): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = now.getTime() - t;
  const hrs = diffMs / HOUR_MS;

  if (hrs < 24) {
    const rounded = Math.max(0, Math.round(hrs));
    return rounded === 0 ? "less than an hour ago" : `${plural(rounded, "hour")} ago`;
  }

  const days = Math.max(0, Math.round(hrs / 24));
  return `${plural(days, "day")} ago`;
}


const OK: RoleRisk = { atRisk: false, reason: "", cause: "none" };

export function computeRoleRisk(input: RoleRiskInput, now: Date = new Date()): RoleRisk {
  const status = (input.status ?? "").toLowerCase();
  // Paused, closed and draft roles are not "at risk" — nothing is promised.
  if (["paused", "closed", "archived", "draft"].includes(status)) return OK;

  // 1 · A decision has been sitting with the client.
  const decisionDays = daysSince(input.oldestAwaitingDecisionAt, now);
  if ((input.awaitingDecision ?? 0) > 0 && decisionDays != null && decisionDays >= DECISION_WAIT_DAYS) {
    return {
      atRisk: true,
      cause: "waiting_on_client",
      reason: `${plural(input.awaitingDecision ?? 0, "candidate")} ${
        (input.awaitingDecision ?? 0) === 1 ? "has" : "have"
      } been waiting on your decision for ${plural(decisionDays, "day")}.`,
    };
  }

  // 2 · An interview was requested and no time is confirmed.
  const interviewDays = daysSince(input.oldestInterviewToConfirmAt, now);
  if ((input.interviewsToConfirm ?? 0) > 0 && interviewDays != null && interviewDays >= INTERVIEW_WAIT_DAYS) {
    return {
      atRisk: true,
      cause: "interview_unscheduled",
      reason: `An interview requested ${plural(interviewDays, "day")} ago still has no confirmed time.`,
    };
  }

  // 3 · We promised a shortlist by a date and it hasn't landed.
  if (input.promisedShortlistBy && !input.shortlistDeliveredAt) {
    const late = daysSince(input.promisedShortlistBy, now);
    if (late != null && new Date(input.promisedShortlistBy).getTime() < now.getTime()) {
      return {
        atRisk: true,
        cause: "promise_missed",
        reason:
          late === 0
            ? "Your first shortlist was due today and has not been delivered."
            : `Your first shortlist was due ${plural(late, "day")} ago and has not been delivered.`,
      };
    }
  }

  // 4 · Nothing has moved at all.
  const stalledDays = daysSince(input.lastMovementAt, now);
  if (stalledDays != null && stalledDays >= STALL_DAYS) {
    return {
      atRisk: true,
      cause: "stalled",
      reason: `Nothing has moved on this role for ${plural(stalledDays, "day")}.`,
    };
  }

  return OK;
}
