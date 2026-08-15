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

const DATE_TIME = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: WORKSPACE_TIMEZONE,
});

const DATE_ONLY = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: WORKSPACE_TIMEZONE,
});

const MONTH_YEAR = new Intl.DateTimeFormat(APP_LOCALE, {
  month: "short",
  year: "numeric",
  timeZone: WORKSPACE_TIMEZONE,
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14/08/2026, 22:25:06" — workspace timezone, never a raw ISO string. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = "",
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return DATE_TIME.format(date);
}

/** "14/08/2026" */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = "",
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return DATE_ONLY.format(date);
}

/**
 * Formats a period string (e.g. "2021-05 – 2024-01") into human-friendly
 * month-year ranges ("May 2021 – Jan 2024").
 */
export function formatPeriod(period: string | null | undefined, fallback = "Date not confirmed"): string {
  if (!period) return fallback;
  
  // Split by the dash/en-dash/em-dash
  const parts = period.split(/\s*[–-]\s*/);
  if (parts.length === 1) {
    const date = toDate(parts[0]);
    return date ? MONTH_YEAR.format(date) : parts[0];
  }

  const formatted = parts.map(p => {
    const trimmed = p.trim();
    if (trimmed.toLowerCase() === "present") return "Present";
    const date = toDate(trimmed);
    return date ? MONTH_YEAR.format(date) : trimmed;
  });

  return formatted.join(" – ");
}

/** True when a string looks like a raw ISO-8601 timestamp (guard for tests/lint). */
export function looksLikeIsoTimestamp(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value.trim())
  );
}
