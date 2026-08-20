import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";
/**
 * "This week" client update — shared shape for the dashboard card and the
 * weekly email.
 *
 * Rules, non-negotiable:
 *  - Every figure comes from a stored event inside the seven-day window.
 *  - Nothing is written by a model; no narrative, no adjectives about effort.
 *  - A week with no movement says so, and names the blocker if one is recorded.
 *  - Card and email render the same object, so the numbers cannot diverge.
 */

export const WEEKLY_WINDOW_DAYS = 7;

/** One counted fact, with the events behind it kept for spot checks. */
export type WeeklyMetric = {
  key: "delivered" | "interviews_held" | "decisions_made";
  /** Plain-English label, singular/plural resolved against the count. */
  label: string;
  count: number;
  /** Role titles the events belong to, deduplicated, in event order. */
  roles: string[];
};

/** A role that cannot progress without the client. */
export type WeeklyAwaitingRole = {
  position_id: string;
  title: string;
  /** What is being waited on, in the client's words. */
  reason: string;
  /** ISO date the wait started, from the underlying record. */
  waiting_since: string | null;
};

/** Recruiting team commitment for the coming week, derived from live records. */
export type WeeklyNextStep = {
  position_id: string | null;
  title: string | null;
  text: string;
};

export type WeeklyUpdate = {
  organization_id: string;
  /** Inclusive window bounds, ISO. */
  window_start: string;
  window_end: string;
  metrics: WeeklyMetric[];
  awaiting_client: WeeklyAwaitingRole[];
  next_week: WeeklyNextStep[];
  /** True when no counted event happened in the window. */
  no_movement: boolean;
  /** Recorded reason for a quiet week; null when nothing explains it. */
  no_movement_reason: string | null;
  generated_at: string;
};

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function metricLabel(key: WeeklyMetric["key"], count: number): string {
  switch (key) {
    case "delivered":
      return plural(count, "Candidate delivered", "Candidates delivered");
    case "interviews_held":
      return plural(count, "Interview held", "Interviews held");
    case "decisions_made":
      return plural(count, "Decision made", "Decisions made");
  }
}

export function totalMovement(update: Pick<WeeklyUpdate, "metrics">): number {
  return update.metrics.reduce((sum, m) => sum + m.count, 0);
}

export function formatWindow(update: Pick<WeeklyUpdate, "window_start" | "window_end">): string {
  const fmt = (iso: string) =>
    formatDate((iso));
  return `${fmt(update.window_start)} – ${fmt(update.window_end)}`;
}

export function formatWaitingSince(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return `Waiting on you since ${new Date(t).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    day: "numeric",
    month: "short",
  })}`;
}

/**
 * Flat lines for the email body. Same object, same numbers as the card — the
 * email never recomputes anything.
 */
export function weeklyEmailLines(update: WeeklyUpdate): string[] {
  if (update.no_movement) {
    return [
      update.no_movement_reason
        ? `No movement this week — ${update.no_movement_reason}`
        : "No movement this week.",
    ];
  }
  return update.metrics
    .filter((m) => m.count > 0)
    .map((m) => `${m.count} ${m.label.toLowerCase()}`);
}
