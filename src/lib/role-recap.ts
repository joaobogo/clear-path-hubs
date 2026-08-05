// Role recap — pure domain rules, no I/O.
//
// After a role closes, the recap exists so the next brief starts from what
// actually happened on THIS role. Every figure is derived from recorded events;
// a figure with no underlying events is absent, never zero. Zero and "we never
// recorded it" mean opposite things to a repeat hirer, so they never share a
// rendering.
//
// Deliberately out of scope: comparison against other clients, any judgement of
// the client's decision quality, and anything beyond a plain duration list.

/** A duration in whole days between two recorded events on this role. */
export type RecapDuration = {
  key: "first_shortlist" | "first_interview" | "offer" | "hire";
  label: string;
  /** null when the end event was never recorded — render "Not recorded". */
  days: number | null;
  /** ISO timestamp of the end event, when recorded. */
  at: string | null;
};

export type RecapCount = {
  key: "delivered" | "interviewed" | "declined";
  label: string;
  /** null when no events of this kind exist at all. */
  value: number | null;
};

export type RecapDeclineReason = {
  code: string;
  label: string;
  count: number;
};

export type RoleRecap = {
  /** The event the durations are measured from. */
  briefAt: string | null;
  durations: RecapDuration[];
  counts: RecapCount[];
  /** At most three, highest first. Empty when the client recorded no reasons. */
  declineReasons: RecapDeclineReason[];
  /** False when there is too little recorded activity to say anything. */
  hasActivity: boolean;
};

export const RECAP_DURATION_LABEL: Record<RecapDuration["key"], string> = {
  first_shortlist: "Brief to first shortlist",
  first_interview: "Brief to first interview",
  offer: "Brief to offer",
  hire: "Brief to hire",
};

export const RECAP_COUNT_LABEL: Record<RecapCount["key"], string> = {
  delivered: "Candidates delivered",
  interviewed: "Interviewed",
  declined: "Declined",
};

/** Whole days between two ISO timestamps, or null when either is missing. */
export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const days = Math.floor((b - a) / 86_400_000);
  return days < 0 ? null : days;
}

/** "3 days" / "1 day" / "Same day" — never a bare number. */
export function formatDuration(days: number | null): string {
  if (days === null) return "Not recorded";
  if (days === 0) return "Same day";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function formatCount(value: number | null): string {
  return value === null ? "Not recorded" : String(value);
}

/** Highest three reasons, ties broken by label so the order is stable. */
export function topDeclineReasons(
  counts: Array<{ code: string; label: string; count: number }>,
): RecapDeclineReason[] {
  return [...counts]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);
}

/**
 * A recap is only worth showing when at least one duration or count came from a
 * recorded event. Otherwise the client sees an honest empty state.
 */
export function hasRecapActivity(input: {
  durations: RecapDuration[];
  counts: RecapCount[];
  declineReasons: RecapDeclineReason[];
}): boolean {
  return (
    input.durations.some((d) => d.days !== null) ||
    input.counts.some((c) => c.value !== null) ||
    input.declineReasons.length > 0
  );
}
