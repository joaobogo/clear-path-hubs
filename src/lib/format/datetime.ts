/**
 * One shared date/time formatter for client-visible timestamps.
 *
 * Raw ISO-8601 strings ("2026-08-15T01:25:06.186+00:00") must never reach the
 * UI: they read as machine output and, worse, they are in UTC while the
 * workspace thinks in its own zone. Everything structured goes through here so
 * the same instant always renders identically across surfaces.
 */

/**
 * Workspace display timezone.
 *
 * This is the organisation's configured zone, not the viewer's browser zone:
 * a Lisbon workspace read from a Brazilian laptop must still show Lisbon
 * times, otherwise a 09:00 interview reads as 05:00 (or worse, the previous
 * midnight). It starts at UTC and is set once the workspace timezone setting
 * loads; there is deliberately no browser fallback.
 */
export let WORKSPACE_TIMEZONE = "UTC";

function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Point every formatter at the organisation's zone. */
export function setWorkspaceTimezone(zone: string | null | undefined): void {
  const candidate = (zone ?? "").trim();
  if (!candidate || candidate === WORKSPACE_TIMEZONE) return;
  if (!isValidZone(candidate)) return;
  WORKSPACE_TIMEZONE = candidate;
}

export function getWorkspaceTimezone(): string {
  return WORKSPACE_TIMEZONE;
}

/**
 * The app UI is written in English, so every date fragment is pinned to one
 * locale. Never pass `undefined` as the locale: that follows the browser
 * setting and produces mixed-language strings ("1 day overdue (14 de ago.)")
 * on an otherwise English screen.
 */
export const APP_LOCALE = "en-GB";

/** en-GB shortens September as "Sept"; the app standard is "Sep". */
const SHORT_MONTH_FIX = /\bSept\b/g;

function normalizeMonth(s: string): string {
  return s.replace(SHORT_MONTH_FIX, "Sep");
}

// Formatters are cached per zone because the workspace zone is only known
// after settings load, so they cannot be built at module scope.
const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${zone}|${JSON.stringify(options)}`;
  const cached = FORMATTER_CACHE.get(key);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat(APP_LOCALE, { ...options, timeZone: zone });
  FORMATTER_CACHE.set(key, fmt);
  return fmt;
}

/** F4: Standardised on 05 Aug 2026 */
const DATE_ONLY_OPTS = { day: "2-digit", month: "short", year: "numeric" } as const;

/** Standardised date-time for audit logs and lists. */
const DATE_TIME_OPTS = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const;

const TIME_ONLY_OPTS = { hour: "2-digit", minute: "2-digit", hour12: false } as const;

const WEEKDAY_ONLY_OPTS = { weekday: "short" } as const;

const MONTH_YEAR_UTC = new Intl.DateTimeFormat(APP_LOCALE, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14 Aug 2026, 22:25" — workspace timezone, never a raw ISO string. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = WORKSPACE_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt = formatter(zone, DATE_TIME_OPTS);
  return normalizeMonth(fmt.format(date));
}

/** "14 Aug 2026" */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = WORKSPACE_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt = formatter(zone, DATE_ONLY_OPTS);
  return normalizeMonth(fmt.format(date));
}

/**
 * The one relative format: "just now", "3 minutes ago", "5 hours ago",
 * "2 days ago". Never an abbreviation like "2d ago" or "1m" — those read as
 * machine output and "1m" is ambiguous between a minute and a month. Past a
 * week the absolute date is more useful, so it falls back to "15 Aug 2026".
 */
export function formatRelative(iso: string | number | Date | null | undefined): string {
  if (!iso) return "—";
  const date = toDate(iso);
  if (!date) return "—";
  const ms = Date.now() - date.getTime();
  if (ms < 0) return formatDate(date);
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(date);
}

/**
 * The same relative wording as `formatRelative`, but able to look forward:
 * "in 3 days", "in 2 hours". Past instants read exactly like
 * `formatRelative` ("3 days ago"), and anything beyond a month falls back to
 * the absolute date. No abbreviations, no "yesterday"/"tomorrow" variants.
 */
export function formatRelativeSigned(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return formatRelative(date);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  if (days <= 30) return `in ${days} ${days === 1 ? "day" : "days"}`;
  return formatDate(date);
}

/**
 * "29 Jun" — a day and month with no year, for compact chart axes. Same month
 * spelling as `formatDate`, so a bucket label and a full date never disagree.
 */
export function formatShortDayMonth(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = "UTC",
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt = formatter(zone, { day: "numeric", month: "short" });
  return normalizeMonth(fmt.format(date));
}

/** "14:30" — workspace timezone. Only for rows that already carry the date. */
export function formatTime(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = WORKSPACE_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt = formatter(zone, TIME_ONLY_OPTS);
  return fmt.format(date);
}

/** "Wed" — a weekday on its own, for short scheduling hints. */
export function formatWeekday(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = WORKSPACE_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt = formatter(zone, WEEKDAY_ONLY_OPTS);
  return fmt.format(date);
}

/** F6: format numbers with commas */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE).format(value);
}

/** G3: Title case helper */
export function toTitleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Pluralization helper for G2 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${formatNumber(count)} ${plural || singular + "s"}`;
}

/**
 * Formats a period string (e.g. "2021-05 – 2024-01") into human-friendly
 * month-year ranges ("May 2021 – Jan 2024").
 */
export function formatPeriod(period: string | null | undefined, fallback = "Date not confirmed"): string {
  if (!period) return fallback;

  const trimmed = period.trim();
  const ymRange = trimmed.match(
    /^(\d{4}-\d{2})\s*[–-—]\s*(present|now|current|\d{4}-\d{2})$/i,
  );
  if (ymRange) {
    const start = ymRange[1]!;
    const endRaw = ymRange[2]!.toLowerCase();
    const end = endRaw === "present" || endRaw === "now" || endRaw === "current" ? "Present" : endRaw;
    const startDate = new Date(`${start}-15T00:00:00Z`);
    const formatted =
      Number.isNaN(startDate.getTime()) ? start : normalizeMonth(MONTH_YEAR_UTC.format(startDate));
    if (end === "Present") return `${formatted} – Present`;
    const endDate = new Date(`${end}-15T00:00:00Z`);
    const formattedEnd =
      Number.isNaN(endDate.getTime()) ? end : normalizeMonth(MONTH_YEAR_UTC.format(endDate));
    return `${formatted} – ${formattedEnd}`;
  }

  const parts = trimmed.split(/\s*[–-—]\s*/);
  if (parts.length === 1) {
    const date = toDate(parts[0]);
    return date ? normalizeMonth(formatter(WORKSPACE_TIMEZONE, DATE_ONLY_OPTS).format(date)) : parts[0];
  }

  const formatted = parts.map((p) => {
    const pTrim = p.trim();
    if (pTrim.toLowerCase() === "present") return "Present";
    const date = toDate(pTrim);
    return date ? normalizeMonth(formatter(WORKSPACE_TIMEZONE, DATE_ONLY_OPTS).format(date)) : pTrim;
  });

  return formatted.join(" – ");
}

/** Calendar-day difference between two dates in the workspace timezone. */
export function calendarDayDiff(a: Date, b: Date): number {
  const fmt = { timeZone: WORKSPACE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" } as const;
  const parseLocal = (d: Date) => {
    const s = new Intl.DateTimeFormat(APP_LOCALE, fmt).format(d);
    const [day, month, year] = s.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  };
  const A = parseLocal(a);
  const B = parseLocal(b);
  return Math.round((A.getTime() - B.getTime()) / 86_400_000);
}

export function looksLikeIsoTimestamp(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value.trim())
  );
}
