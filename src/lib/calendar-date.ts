/**
 * Calendar dates (start date, renewal date, guarantee window, response date)
 * are stored as Postgres `date` — a day with no time and no zone. Rendering
 * them with `new Date("2026-09-01").toLocaleDateString()` parses UTC midnight
 * and then prints it in the viewer's zone, so every negative-offset viewer saw
 * the day before ("31 Aug" on one page, "1 Sep" on another).
 *
 * A calendar date must be read and printed in UTC, always. Use these helpers
 * for any `date` column; use the time-zone helpers in `@/lib/time/zone-label`
 * for real timestamps such as interview times.
 */

/** Accepts "2026-09-01" or a full ISO timestamp; keeps only the calendar day. */
function toUtcDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "1 Sep 2026" — identical for every viewer, in every timezone. */
export function formatCalendarDate(
  value: string | null | undefined,
  fallback = "—",
): string {
  const d = toUtcDay(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "1 September 2026" for headline placements. */
export function formatCalendarDateLong(
  value: string | null | undefined,
  fallback = "—",
): string {
  const d = toUtcDay(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The `YYYY-MM-DD` form, for `<input type="date">` values and comparisons. */
export function calendarDateInputValue(value: string | null | undefined): string {
  const d = toUtcDay(value);
  return d ? d.toISOString().slice(0, 10) : "";
}
