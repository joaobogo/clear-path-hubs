import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";
/**
 * Dated role timeline for the client position detail page.
 *
 * Rules (non-negotiable):
 *  - Real stored timestamps only. A step without one is "Not yet".
 *  - Never infer a date from an adjacent step, and never fall back to the
 *    role creation date.
 *  - No future dates, no estimates, no percentage complete.
 */

export type RoleTimelineStepKey =
  | "brief_confirmed"
  | "sourcing_started"
  | "first_shortlist"
  | "first_interview"
  | "offer"
  | "hired";

export type RoleTimelineInput = {
  briefConfirmedAt?: string | null;
  sourcingStartedAt?: string | null;
  firstShortlistAt?: string | null;
  firstInterviewAt?: string | null;
  offerAt?: string | null;
  hiredAt?: string | null;
  /** Injectable for tests. */
  now?: Date;
};

export type RoleTimelineStep = {
  key: RoleTimelineStepKey;
  label: string;
  /** ISO timestamp, or null when nothing is stored. */
  at: string | null;
  /** True only when a real timestamp exists. */
  complete: boolean;
  /** Whole days since the previous completed step; null when not computable. */
  daysFromPrevious: number | null;
};

export type RoleTimeline = {
  steps: RoleTimelineStep[];
  /** True when no step has a stored timestamp. */
  empty: boolean;
};

const LABELS: Record<RoleTimelineStepKey, string> = {
  brief_confirmed: "Brief confirmed",
  sourcing_started: "Sourcing started",
  first_shortlist: "First shortlist",
  first_interview: "First interview",
  offer: "Offer",
  hired: "Hired",
};

const ORDER: RoleTimelineStepKey[] = [
  "brief_confirmed",
  "sourcing_started",
  "first_shortlist",
  "first_interview",
  "offer",
  "hired",
];

const DAY = 86_400_000;

/** Accepts a value only if it parses and is not in the future. */
function realPastTimestamp(value: string | null | undefined, now: Date): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  if (t > now.getTime()) return null;
  return new Date(t).toISOString();
}

export function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / DAY));
}

export function buildRoleTimeline(input: RoleTimelineInput): RoleTimeline {
  const now = input.now ?? new Date();
  const raw: Record<RoleTimelineStepKey, string | null> = {
    brief_confirmed: realPastTimestamp(input.briefConfirmedAt, now),
    sourcing_started: realPastTimestamp(input.sourcingStartedAt, now),
    first_shortlist: realPastTimestamp(input.firstShortlistAt, now),
    first_interview: realPastTimestamp(input.firstInterviewAt, now),
    offer: realPastTimestamp(input.offerAt, now),
    hired: realPastTimestamp(input.hiredAt, now),
  };

  let previous: string | null = null;
  const steps: RoleTimelineStep[] = ORDER.map((key) => {
    const at = raw[key];
    const daysFromPrevious = at && previous ? daysBetween(previous, at) : null;
    if (at) previous = at;
    return {
      key,
      label: LABELS[key],
      at,
      complete: Boolean(at),
      daysFromPrevious,
    };
  });

  return { steps, empty: steps.every((s) => !s.complete) };
}

export function formatTimelineDate(iso: string | null): string {
  if (!iso) return "Not yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not yet";
  return formatDate(d);
}
