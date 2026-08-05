/**
 * Native scheduler configuration — client-safe, zero external dependencies.
 *
 * Availability is OURS: business hours in the host timezone, 30-minute slots,
 * across the next N business days. Every value below ships with a working
 * default so booking works with no setup at all; each one can be overridden
 * with a build-time env var when the sales calendar changes.
 *
 * No Calendly, no third-party account, no API key.
 */

function envStr(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw.length > 0 ? raw : fallback;
}

function envInt(value: unknown, fallback: number, min: number, max: number): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

function envUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Timezone the business hours below are expressed in. */
export const HOST_TIMEZONE = envStr(
  import.meta.env["VITE_BOOKING_HOST_TIMEZONE"],
  "Europe/Copenhagen",
);

/** Mon–Fri 09:00–17:00 host time, in minutes from midnight. */
export const BUSINESS_START_MINUTE = envInt(
  import.meta.env["VITE_BOOKING_START_MINUTE"],
  9 * 60,
  0,
  23 * 60,
);
export const BUSINESS_END_MINUTE = envInt(
  import.meta.env["VITE_BOOKING_END_MINUTE"],
  17 * 60,
  60,
  24 * 60,
);

export const SLOT_MINUTES = envInt(import.meta.env["VITE_BOOKING_SLOT_MINUTES"], 30, 15, 120);

/** How many business days ahead we open for booking. */
export const HORIZON_BUSINESS_DAYS = envInt(
  import.meta.env["VITE_BOOKING_HORIZON_DAYS"],
  10,
  1,
  30,
);

/** Nothing can be booked inside this window from now. */
export const MIN_LEAD_MINUTES = envInt(import.meta.env["VITE_BOOKING_LEAD_MINUTES"], 120, 0, 2880);

export const HOST_NAME = envStr(import.meta.env["VITE_BOOKING_HOST_NAME"], "TaaSFlow team");
export const HOST_EMAIL = envStr(import.meta.env["VITE_BOOKING_HOST_EMAIL"], "hello@taasflow.com");

/**
 * Optional standing meeting room. When unset we store null and tell the visitor
 * the link arrives by email — we never invent a URL that does not exist.
 */
export const MEETING_JOIN_URL = envUrl(import.meta.env["VITE_BOOKING_MEETING_URL"]);

/** Timezones offered in the picker, on top of the visitor's detected one. */
export const TIMEZONE_CHOICES: readonly string[] = [
  "Europe/Copenhagen",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Warsaw",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export const SCHEDULER_CONFIG = {
  hostTimezone: HOST_TIMEZONE,
  startMinute: BUSINESS_START_MINUTE,
  endMinute: BUSINESS_END_MINUTE,
  slotMinutes: SLOT_MINUTES,
  businessDays: HORIZON_BUSINESS_DAYS,
  leadMinutes: MIN_LEAD_MINUTES,
} as const;
