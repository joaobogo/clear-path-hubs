/**
 * Candidate general availability — stated once, not negotiated per interview.
 *
 * This is a *preference*, never a commitment: everything is optional, nothing
 * blocks a proposal, and a slot outside the preference is still allowed (the
 * scheduler simply sees it is outside). Stored on
 * `candidate_profiles.availability` under the `preference` key so the free-text
 * availability note keeps working alongside it.
 *
 * Browser-safe: shared by the settings form and by the server so the two
 * cannot drift.
 */

import { z } from "zod";

/* ---------- vocabulary ---------- */

export const AVAILABILITY_DAYS = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
  { value: 0, label: "Sun", full: "Sunday" },
] as const;

export const AVAILABILITY_BANDS = [
  {
    value: "morning",
    label: "Morning",
    hint: "Before midday",
    startMinute: 6 * 60,
    endMinute: 12 * 60,
  },
  {
    value: "afternoon",
    label: "Afternoon",
    hint: "Midday to 5pm",
    startMinute: 12 * 60,
    endMinute: 17 * 60,
  },
  {
    value: "evening",
    label: "Evening",
    hint: "After 5pm",
    startMinute: 17 * 60,
    endMinute: 22 * 60,
  },
] as const;

export type AvailabilityBand = (typeof AVAILABILITY_BANDS)[number]["value"];

const BAND_VALUES = AVAILABILITY_BANDS.map((b) => b.value) as [
  AvailabilityBand,
  ...AvailabilityBand[],
];

export function bandLabel(band: AvailabilityBand): string {
  return AVAILABILITY_BANDS.find((b) => b.value === band)?.label ?? band;
}

export function dayLabel(day: number): string {
  return AVAILABILITY_DAYS.find((d) => d.value === day)?.label ?? String(day);
}

/* ---------- schema ---------- */

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-24.");

export const availabilityPreferenceSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  bands: z.array(z.enum(BAND_VALUES)).max(3).default([]),
  timezone: z.string().trim().max(80).default(""),
  unavailable_dates: z.array(isoDate).max(30).default([]),
  note: z.string().trim().max(300).default(""),
});

export type AvailabilityPreference = z.infer<typeof availabilityPreferenceSchema>;

export type StoredAvailabilityPreference = AvailabilityPreference & {
  updated_at: string;
};

export function emptyPreference(timezone = ""): AvailabilityPreference {
  return { days: [], bands: [], timezone, unavailable_dates: [], note: "" };
}

/** Normalise: sorted, de-duplicated, past dates dropped, zone validated. */
export function normalizePreference(
  input: AvailabilityPreference,
  now = new Date(),
): AvailabilityPreference {
  const today = isoDateInZone(now, "UTC");
  return {
    days: [...new Set(input.days)].sort((a, b) => a - b),
    bands: AVAILABILITY_BANDS.map((b) => b.value).filter((b) => input.bands.includes(b)),
    timezone: isValidZone(input.timezone) ? input.timezone : "",
    unavailable_dates: [...new Set(input.unavailable_dates)]
      .filter((d) => d >= today)
      .sort()
      .slice(0, 30),
    note: input.note.slice(0, 300),
  };
}

/** Read whatever is on `candidate_profiles.availability` without throwing. */
export function parseStoredPreference(availability: unknown): AvailabilityPreference | null {
  if (!availability || typeof availability !== "object") return null;
  const raw = (availability as Record<string, unknown>)["preference"];
  if (!raw || typeof raw !== "object") return null;
  const parsed = availabilityPreferenceSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export function isPreferenceSet(pref: AvailabilityPreference | null): boolean {
  if (!pref) return false;
  return (
    pref.days.length > 0 ||
    pref.bands.length > 0 ||
    pref.unavailable_dates.length > 0 ||
    pref.note.trim().length > 0
  );
}

/** Merge a preference into the existing availability JSON, keeping the note. */
export function mergeIntoAvailability(
  existing: unknown,
  pref: AvailabilityPreference,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" ? { ...(existing as Record<string, unknown>) } : {};
  base["preference"] = { ...pref, updated_at: new Date().toISOString() };
  return base;
}

/* ---------- reading it back ---------- */

export const EMPTY_PREFERENCE_LINE =
  "Not set — we will propose times and you can choose.";

/** One or two plain lines a scheduler (or the candidate) can read at a glance. */
export function preferenceSummary(pref: AvailabilityPreference | null): string[] {
  if (!isPreferenceSet(pref) || !pref) return [EMPTY_PREFERENCE_LINE];
  const lines: string[] = [];
  const parts: string[] = [];
  parts.push(
    pref.days.length > 0
      ? `Prefers ${pref.days
          .slice()
          .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
          .map(dayLabel)
          .join(", ")}`
      : "Any day",
  );
  parts.push(
    pref.bands.length > 0
      ? pref.bands.map((b) => bandLabel(b).toLowerCase()).join(", ")
      : "any time of day",
  );
  if (pref.timezone) parts.push(pref.timezone);
  lines.push(parts.join(" · "));
  if (pref.unavailable_dates.length > 0) {
    lines.push(`Away: ${pref.unavailable_dates.join(", ")}`);
  }
  if (pref.note.trim()) lines.push(pref.note.trim());
  return lines;
}

/* ---------- timezone helpers (self-contained) ---------- */

export function isValidZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = shortDays.indexOf(get("weekday"));
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: weekday < 0 ? 0 : weekday,
    minuteOfDay: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

export function isoDateInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, isValidZone(timeZone) ? timeZone : "UTC");
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Does a proposed instant sit inside the stated preference?
 * An unset preference matches everything — silence is not a restriction.
 */
export function slotFitsPreference(
  iso: string,
  pref: AvailabilityPreference | null,
): boolean {
  if (!isPreferenceSet(pref) || !pref) return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  const zone = isValidZone(pref.timezone) ? pref.timezone : "UTC";
  const p = partsInZone(date, zone);

  if (pref.unavailable_dates.includes(`${p.year}-${p.month}-${p.day}`)) return false;
  if (pref.days.length > 0 && !pref.days.includes(p.weekday)) return false;
  if (pref.bands.length > 0) {
    const inBand = pref.bands.some((value) => {
      const band = AVAILABILITY_BANDS.find((b) => b.value === value);
      if (!band) return false;
      return p.minuteOfDay >= band.startMinute && p.minuteOfDay < band.endMinute;
    });
    if (!inBand) return false;
  }
  return true;
}

/**
 * Reduce generated slots to the ones the candidate said work.
 * If nothing fits, the original list is returned — a stated preference must
 * never leave a candidate with no times at all.
 */
export function filterSlotsByPreference(
  slots: string[],
  pref: AvailabilityPreference | null,
): string[] {
  if (!isPreferenceSet(pref)) return slots;
  const fitting = slots.filter((s) => slotFitsPreference(s, pref));
  return fitting.length > 0 ? fitting : slots;
}
