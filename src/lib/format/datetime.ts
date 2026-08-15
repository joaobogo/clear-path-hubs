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

  const trimmed = period.trim();

  // Recognise canonical YYYY-MM – YYYY-MM / YYYY-MM – present ranges.
  // The start/end halves are parsed in UTC so the month is correct regardless
  // of the display timezone; the formatter then renders in the workspace zone.
  const ymRange = trimmed.match(
    /^(\d{4}-\d{2})\s*[–-—]\s*(present|now|current|\d{4}-\d{2})$/i,
  );
  if (ymRange) {
    const start = ymRange[1]!;
    const endRaw = ymRange[2]!.toLowerCase();
    const end = endRaw === "present" || endRaw === "now" || endRaw === "current" ? "Present" : endRaw;
    const startDate = new Date(`${start}-15T00:00:00Z`);
    const formatted =
      Number.isNaN(startDate.getTime()) ? start : MONTH_YEAR_UTC.format(startDate);
    if (end === "Present") return `${formatted} – Present`;
    const endDate = new Date(`${end}-15T00:00:00Z`);
    const formattedEnd =
      Number.isNaN(endDate.getTime()) ? end : MONTH_YEAR_UTC.format(endDate);
    return `${formatted} – ${formattedEnd}`;
  }


  // Split by dash/en-dash/em-dash, then format each part.
  const parts = trimmed.split(/\s*[–-—]\s*/);
  if (parts.length === 1) {
    const date = toDate(parts[0]);
    return date ? MONTH_YEAR.format(date) : parts[0];
  }

  const formatted = parts.map((p) => {
    const pTrim = p.trim();
    if (pTrim.toLowerCase() === "present") return "Present";
    const date = toDate(pTrim);
    return date ? MONTH_YEAR.format(date) : pTrim;
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
