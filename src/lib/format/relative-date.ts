/**
 * THE date-label utility. Every client surface (interviews, overview queue,
 * approvals, candidate activity, offers) derives relative labels, overdue math
 * and due-date labels from here — nowhere else.
 *
 * Two rules make the "tomorrow on a date two days away" and "3 vs 4 days
 * overdue on one screen" classes of bug impossible:
 *
 *  1. Everything is computed on *calendar days* in ONE timezone
 *     (`WORKSPACE_TIMEZONE`, the viewer-facing workspace zone), never on
 *     elapsed milliseconds. `Math.round(diffMs / DAY)` was the old bug: the
 *     same instant rounded to 3 days on one card and 4 on another, and a
 *     meeting 40 hours away rounded to "tomorrow".
 *  2. A relative label and its overdue count come from the SAME integer
 *     (`calendarDaysUntil`), so a label can never contradict the absolute date
 *     printed beside it.
 */

import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

type DateInput = string | number | Date | null | undefined;

const partsCache = new Map<string, Intl.DateTimeFormat>();

function dayParts(zone: string): Intl.DateTimeFormat {
  const cached = partsCache.get(zone);
  if (cached) return cached;
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    fmt = dayParts(WORKSPACE_TIMEZONE);
  }
  partsCache.set(zone, fmt);
  return fmt;
}

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Days since the epoch for the calendar day this instant falls on, in the
 * workspace timezone. Integer, so day arithmetic is exact.
 */
export function calendarDayIndex(
  value: DateInput,
  zone: string = WORKSPACE_TIMEZONE,
): number | null {
  const date = toDate(value);
  if (!date) return null;
  const parts = dayParts(zone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Calendar days from `now` to `value`: 0 = today, 1 = tomorrow, -2 = 2 days ago. */
export function calendarDaysUntil(
  value: DateInput,
  now: DateInput = new Date(),
  zone: string = WORKSPACE_TIMEZONE,
): number | null {
  const target = calendarDayIndex(value, zone);
  const base = calendarDayIndex(now, zone) ?? calendarDayIndex(new Date(), zone);
  if (target == null || base == null) return null;
  return target - base;
}

/** Calendar days elapsed since `value`. Negative for future dates. */
export function calendarDaysSince(
  value: DateInput,
  now: DateInput = new Date(),
  zone: string = WORKSPACE_TIMEZONE,
): number | null {
  const until = calendarDaysUntil(value, now, zone);
  if (until == null) return null;
  return until === 0 ? 0 : -until;
}

/** "today" | "tomorrow" | "yesterday" | "in 2 days" | "3 days ago". */
/**
 * `zone` must be the SAME zone as the absolute date printed beside the label:
 * an interview shown in UTC is labelled against UTC calendar days, otherwise
 * "Wed, 19 Aug (UTC)" could read "today" in a UTC-3 workspace.
 */
export function relativeDayLabel(
  value: DateInput,
  now: DateInput = new Date(),
  zone: string = WORKSPACE_TIMEZONE,
): string {
  const diff = calendarDaysUntil(value, now, zone);
  if (diff == null) return "";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

/** Past-facing age label: "today" | "yesterday" | "5 days ago" | "2 months ago". */
export function agoLabel(value: DateInput, now: DateInput = new Date()): string {
  const days = calendarDaysSince(value, now);
  if (days == null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}

/**
 * Whole calendar days a deadline is late. 0 when it is due today or later, so
 * "Due today" and "overdue" can never both be true for one record.
 */
export function overdueDays(due: DateInput, now: DateInput = new Date()): number {
  const diff = calendarDaysUntil(due, now);
  if (diff == null || diff >= 0) return 0;
  return Math.abs(diff);
}

/** True only once the due day is strictly before today (workspace zone). */
export function isOverdueDate(due: DateInput, now: DateInput = new Date()): boolean {
  return overdueDays(due, now) > 0;
}

/**
 * "No deadline" | "3 days overdue" | "1 day overdue" | "Due today" |
 * "Due tomorrow" | "Due in 4 days".
 */
export function dueDateLabel(
  due: DateInput,
  now: DateInput = new Date(),
  fallback = "No deadline",
): string {
  const diff = calendarDaysUntil(due, now);
  if (diff == null) return fallback;
  if (diff < 0) {
    const late = Math.abs(diff);
    return late === 1 ? "1 day overdue" : `${late} days overdue`;
  }
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}
