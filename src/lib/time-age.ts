// Visible clock helpers — turn timestamps into plain-language age.
//
// Clients judge a service by responsiveness, so every queue item and stage
// carries its age. Pure module: no server imports, safe on both sides.

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between a timestamp and now. Null when unknown. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS);
  return diff < 0 ? 0 : diff;
}

/** "today" | "1 day" | "6 days" | "3 weeks". Empty string when unknown. */
export function formatAge(iso: string | null | undefined, now: Date = new Date()): string {
  const days = daysSince(iso, now);
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

/** "waiting 3 days" / "waiting since today". */
export function formatWaiting(iso: string | null | undefined, now: Date = new Date()): string {
  const age = formatAge(iso, now);
  if (!age) return "";
  return age === "today" ? "waiting since today" : `waiting ${age}`;
}

/** "5 days in stage" / "in stage today". */
export function formatDaysInStage(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  const days = daysSince(iso, now);
  if (days == null) return "";
  if (days === 0) return "today";
  return days === 1 ? "1 day in stage" : `${days} days in stage`;
}

export type AgeTone = "fresh" | "aging" | "overdue";

/** Escalates with age so delay is obvious, not buried. */
export function ageTone(
  iso: string | null | undefined,
  thresholds: { aging: number; overdue: number } = { aging: 3, overdue: 7 },
  now: Date = new Date(),
): AgeTone {
  const days = daysSince(iso, now) ?? 0;
  if (days >= thresholds.overdue) return "overdue";
  if (days >= thresholds.aging) return "aging";
  return "fresh";
}
