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

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: WORKSPACE_TIMEZONE,
});

const DATE_ONLY = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
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

/** True when a string looks like a raw ISO-8601 timestamp (guard for tests/lint). */
export function looksLikeIsoTimestamp(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value.trim())
  );
}
