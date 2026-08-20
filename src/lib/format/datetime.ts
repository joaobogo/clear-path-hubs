/**
 * One shared date/time formatter for client-visible timestamps.
 *
 * Raw ISO-8601 strings ("2026-08-15T01:25:06.186+00:00") must never reach the
 * UI: they read as machine output and, worse, they are in UTC while the
 * workspace thinks in its own zone. Everything structured goes through here so
 * the same instant always renders identically across surfaces.
 */

/** Workspace display timezone. */
export const WORKSPACE_TIMEZONE = "America/Sao_Paulo";

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

/** F4: Standardised on 05 Aug 2026 */
const DATE_ONLY = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: WORKSPACE_TIMEZONE,
});

/** Standardised date-time for audit logs and lists. */
const DATE_TIME = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: WORKSPACE_TIMEZONE,
});

const TIME_ONLY = new Intl.DateTimeFormat(APP_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: WORKSPACE_TIMEZONE,
});

const WEEKDAY_ONLY = new Intl.DateTimeFormat(APP_LOCALE, {
  weekday: "short",
  timeZone: WORKSPACE_TIMEZONE,
});

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
  const fmt =
    zone === WORKSPACE_TIMEZONE
      ? DATE_TIME
      : new Intl.DateTimeFormat(APP_LOCALE, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: zone,
        });
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
  const fmt =
    zone === WORKSPACE_TIMEZONE
      ? DATE_ONLY
      : new Intl.DateTimeFormat(APP_LOCALE, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: zone,
        });
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

/** "14:30" — workspace timezone. Only for rows that already carry the date. */
export function formatTime(
  value: string | number | Date | null | undefined,
  fallback = "",
  zone = WORKSPACE_TIMEZONE,
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const fmt =
    zone === WORKSPACE_TIMEZONE
      ? TIME_ONLY
      : new Intl.DateTimeFormat(APP_LOCALE, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: zone,
        });
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
  const fmt =
    zone === WORKSPACE_TIMEZONE
      ? WEEKDAY_ONLY
      : new Intl.DateTimeFormat(APP_LOCALE, {
          weekday: "short",
          timeZone: zone,
        });
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
    return date ? normalizeMonth(DATE_ONLY.format(date)) : parts[0];
  }

  const formatted = parts.map((p) => {
    const pTrim = p.trim();
    if (pTrim.toLowerCase() === "present") return "Present";
    const date = toDate(pTrim);
    return date ? normalizeMonth(DATE_ONLY.format(date)) : pTrim;
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
