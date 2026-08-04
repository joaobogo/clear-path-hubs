/**
 * System health and freshness strip — pure logic.
 *
 * Rules that this module enforces, deliberately:
 *  - "Operational" is a claim. It is only allowed when the workspace has enough
 *    real, recent evidence to support it (`evidence: "measured"`). Without
 *    evidence the signal reports `unknown` ("Not measured yet") or
 *    `unavailable` ("You don't have access to this") — never a green light.
 *  - No raw error strings, job ids, trace ids, model names or provider messages
 *    are ever carried in this shape. The server read strips them at the source.
 *  - Every state has a text label and a distinct icon, so nothing is conveyed
 *    by colour alone.
 *  - Alerts are rationed: only `action_required` and `degraded` are allowed to
 *    escalate the overall strip, and the strip reports one headline, not eight.
 */

export const SIGNAL_KEYS = [
  "agents",
  "sync",
  "discovery",
  "scoring",
  "approvals",
  "integrations",
  "freshness",
  "issues",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

export const HEALTH_STATES = [
  "operational",
  "processing",
  "waiting_approval",
  "delayed",
  "degraded",
  "action_required",
  "unknown",
  "unavailable",
] as const;

export type HealthState = (typeof HEALTH_STATES)[number];

/** Why we are allowed to say what we are saying. */
export type SignalEvidence = "measured" | "not_measured" | "no_access";

export type HealthActionKey =
  | "open_approvals"
  | "open_roles"
  | "open_agents"
  | "open_integrations"
  | "open_activity"
  | "refresh";

export type HealthSignal = {
  key: SignalKey;
  /** Short label for the compact strip. */
  label: string;
  state: HealthState;
  evidence: SignalEvidence;
  /** One plain line the reader can act on. Never an internal error. */
  detail: string;
  /** ISO timestamp this signal is measured from, when there is one. */
  measured_at: string | null;
  /** Count this signal stands for, when counting is meaningful. */
  count: number | null;
  actions: HealthActionKey[];
};

export type SystemHealth = {
  organization_id: string;
  signals: HealthSignal[];
  /** The single state shown when the strip is collapsed. */
  overall: HealthState;
  /** One line for the collapsed strip. */
  headline: string;
  /** How many signals are asking for a person. */
  attention_count: number;
  fetched_at: string;
  can_read: boolean;
};

export const SIGNAL_LABEL: Record<SignalKey, string> = {
  agents: "Agents",
  sync: "Last sync",
  discovery: "Discovery",
  scoring: "Scoring",
  approvals: "Approvals",
  integrations: "Integrations",
  freshness: "Data",
  issues: "Issues",
};

export const STATE_LABEL: Record<HealthState, string> = {
  operational: "Operational",
  processing: "Processing",
  waiting_approval: "Waiting for approval",
  delayed: "Delayed",
  degraded: "Degraded",
  action_required: "Action required",
  unknown: "Not measured yet",
  unavailable: "Not available to you",
};

/** Shown next to the label so state never depends on colour. */
export const STATE_SHORT: Record<HealthState, string> = {
  operational: "OK",
  processing: "Running",
  waiting_approval: "You",
  delayed: "Late",
  degraded: "Degraded",
  action_required: "Action",
  unknown: "—",
  unavailable: "Hidden",
};

/** Escalation order: later wins when rolling signals up to one headline. */
const STATE_RANK: Record<HealthState, number> = {
  unavailable: 0,
  unknown: 1,
  operational: 2,
  processing: 3,
  waiting_approval: 4,
  delayed: 5,
  degraded: 6,
  action_required: 7,
};

export function stateRank(state: HealthState): number {
  return STATE_RANK[state];
}

/** True when the state should draw the eye. Nothing else may raise an alert. */
export function isAttention(state: HealthState): boolean {
  return state === "action_required" || state === "degraded" || state === "delayed";
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function signal(
  key: SignalKey,
  partial: Omit<HealthSignal, "key" | "label"> & { label?: string },
): HealthSignal {
  return {
    key,
    label: partial.label ?? SIGNAL_LABEL[key],
    state: partial.state,
    evidence: partial.evidence,
    detail: partial.detail,
    measured_at: partial.measured_at,
    count: partial.count,
    actions: partial.actions,
  };
}

/** A signal the caller's seat is not allowed to see. Never a green light. */
export function hiddenSignal(key: SignalKey, who: string): HealthSignal {
  return signal(key, {
    state: "unavailable",
    evidence: "no_access",
    detail: `Ask ${who} — this isn't shown on your seat.`,
    measured_at: null,
    count: null,
    actions: [],
  });
}

/** A signal with nothing behind it yet. Never a green light. */
export function unknownSignal(key: SignalKey, detail: string): HealthSignal {
  return signal(key, {
    state: "unknown",
    evidence: "not_measured",
    detail,
    measured_at: null,
    count: null,
    actions: [],
  });
}

/**
 * Roll the signals up into one honest headline.
 *
 * If every signal is unknown or unavailable, the strip says so — it does not
 * claim the system is fine, and it does not claim it is broken.
 */
export function summarise(
  signals: readonly HealthSignal[],
  now: Date = new Date(),
): Pick<SystemHealth, "overall" | "headline" | "attention_count" | "fetched_at"> {
  const fetched_at = now.toISOString();
  const measured = signals.filter((s) => s.evidence === "measured");
  const attention = signals.filter((s) => isAttention(s.state));

  if (signals.length === 0 || measured.length === 0) {
    return {
      overall: "unknown",
      headline: "Not enough activity yet to report system status.",
      attention_count: 0,
      fetched_at,
    };
  }

  const worst = [...signals].sort((a, b) => stateRank(b.state) - stateRank(a.state))[0]!;

  if (attention.length > 0) {
    const lead = [...attention].sort((a, b) => stateRank(b.state) - stateRank(a.state))[0]!;
    return {
      overall: lead.state,
      headline:
        attention.length === 1
          ? lead.detail
          : `${lead.detail} ${attention.length - 1} other signal${
              attention.length - 1 === 1 ? "" : "s"
            } need${attention.length - 1 === 1 ? "s" : ""} a look.`,
      attention_count: attention.length,
      fetched_at,
    };
  }

  if (worst.state === "waiting_approval") {
    return {
      overall: "waiting_approval",
      headline: worst.detail,
      attention_count: 0,
      fetched_at,
    };
  }

  if (worst.state === "processing") {
    return {
      overall: "processing",
      headline: "Work is running now. Nothing is waiting on you.",
      attention_count: 0,
      fetched_at,
    };
  }

  // Only here may we say "Operational", and only from measured signals.
  return {
    overall: "operational",
    headline: `Running normally across ${measured.length} checked signal${
      measured.length === 1 ? "" : "s"
    }.`,
    attention_count: 0,
    fetched_at,
  };
}

/** Hours since an ISO timestamp, or null when there is nothing to measure. */
export function hoursSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / HOUR_MS;
}

/** Newest of a set of timestamps, ignoring blanks. */
export function newest(...values: (string | null | undefined)[]): string | null {
  const list = values.filter((v): v is string => !!v && !Number.isNaN(new Date(v).getTime()));
  if (list.length === 0) return null;
  return list.sort((a, b) => (a < b ? 1 : -1))[0]!;
}

export function freshnessWord(hours: number): string {
  if (hours < 1) return "in the last hour";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const ACTION_LABEL: Record<HealthActionKey, string> = {
  open_approvals: "Review candidates",
  open_roles: "Open roles",
  open_agents: "Agent settings",
  open_integrations: "Integrations",
  open_activity: "See activity",
  refresh: "Check again",
};

export const ACTION_TO: Record<Exclude<HealthActionKey, "refresh">, string> = {
  open_approvals: "/client/shortlist",
  open_roles: "/client/roles",
  open_agents: "/client/agents",
  open_integrations: "/client/account",
  open_activity: "/client",
};
