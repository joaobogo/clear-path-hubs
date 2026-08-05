/**
 * Canonical pilot rules.
 *
 * One source of truth for how long a pilot runs, what it includes, and what
 * happens the day after it ends. Anything that displays or enforces pilot
 * state reads from here — no second copy of "14" anywhere in the codebase.
 */

/** Pilot length in days, measured from the moment the pilot role goes live. */
export const PILOT_DURATION_DAYS = 14;

/** What the pilot covers. Used on client-facing surfaces verbatim. */
export const PILOT_INCLUDES = [
  "One role, run end to end by a recruiter.",
  "Full workspace access for your hiring team.",
  "Shortlist delivered in days.",
] as const;

/** What happens on day one after the pilot window closes. */
export const PILOT_AFTER_END =
  "The role stays open and your workspace stays readable. New roles need a plan before they can go live. Nothing is deleted.";

/** Only platform staff can extend or waive a pilot window. */
export const PILOT_OVERRIDE_ROLE = "platform_admin" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compute the end of a pilot window from its start. */
export function pilotEndsAt(startedAt: Date | string): Date {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  return new Date(start.getTime() + PILOT_DURATION_DAYS * DAY_MS);
}

export type PilotPhase = "not_started" | "active" | "ending_soon" | "ended" | "overridden";

export type PilotState = {
  phase: PilotPhase;
  daysLeft: number | null;
  endsAt: string | null;
  /** True when new roles must be paid for before they can go live. */
  requiresPlanForNewRoles: boolean;
  /** One plain line for the client, safe to render as-is. */
  message: string;
};

export function derivePilotState(input: {
  pilot_status: string | null;
  pilot_ends_at: string | null;
  pilot_admin_override?: boolean | null;
  now?: Date;
}): PilotState {
  const now = input.now ?? new Date();
  const endsAt = input.pilot_ends_at;

  if (input.pilot_admin_override) {
    return {
      phase: "overridden",
      daysLeft: null,
      endsAt,
      requiresPlanForNewRoles: false,
      message: "Pilot window extended by TaaSFlow. No end date is being enforced.",
    };
  }

  if (input.pilot_status !== "active" || !endsAt) {
    return {
      phase: "not_started",
      daysLeft: null,
      endsAt: null,
      requiresPlanForNewRoles: false,
      message: "No pilot is running on this account.",
    };
  }

  const daysLeft = Math.ceil((new Date(endsAt).getTime() - now.getTime()) / DAY_MS);

  if (daysLeft <= 0) {
    return {
      phase: "ended",
      daysLeft: 0,
      endsAt,
      requiresPlanForNewRoles: true,
      message: `Your pilot ended. ${PILOT_AFTER_END}`,
    };
  }

  if (daysLeft <= 3) {
    return {
      phase: "ending_soon",
      daysLeft,
      endsAt,
      requiresPlanForNewRoles: false,
      message: `Pilot ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}. ${PILOT_AFTER_END}`,
    };
  }

  return {
    phase: "active",
    daysLeft,
    endsAt,
    requiresPlanForNewRoles: false,
    message: `Pilot in progress — ${daysLeft} days left.`,
  };
}
