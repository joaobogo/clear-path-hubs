// Browser-safe scheduling + timezone helpers.
// Single source of truth for how TaaSFlow renders interview times so no
// surface can show an ambiguous or invented date.

export const INTERVIEW_STATUSES = [
  "requested",
  "scheduling",
  "scheduled",
  "completed",
  "cancelled",
] as const;
export type InterviewStatusValue = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_STATUS_LABEL: Record<InterviewStatusValue, string> = {
  requested: "Requested",
  scheduling: "Coordinating",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INTERVIEW_STATUS_TONE: Record<
  InterviewStatusValue,
  "neutral" | "info" | "success" | "warning" | "muted"
> = {
  requested: "warning",
  scheduling: "info",
  scheduled: "success",
  completed: "neutral",
  cancelled: "muted",
};

/** Candidate-safe wording. Candidates never see coordination internals. */
export const CANDIDATE_INTERVIEW_LABEL: Record<InterviewStatusValue, string> = {
  requested: "Interview requested",
  scheduling: "Choosing a time",
  scheduled: "Interview scheduled",
  completed: "Interview completed",
  cancelled: "Interview cancelled",
};

/** The viewer's IANA timezone, falling back to UTC when unavailable. */
export function viewerTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function safeZone(tz?: string | null): string {
  if (tz && isValidTimezone(tz)) return tz;
  return "UTC";
}

/** Short timezone name, e.g. "GMT+1" — always rendered next to a time. */
export function timezoneAbbr(iso: string, tz?: string | null): string {
  const zone = safeZone(tz);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date(iso));
    return parts.find((p) => p.type === "timeZoneName")?.value ?? zone;
  } catch {
    return zone;
  }
}

/**
 * Absolute, unambiguous rendering: date, time, zone name and offset.
 * Never call toLocaleString() directly in interview UI — use this.
 */
export function formatInZone(
  iso: string | null | undefined,
  tz?: string | null,
  opts?: { withDate?: boolean },
): string {
  if (!iso) return "—";
  const zone = safeZone(tz);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const withDate = opts?.withDate !== false;
  const body = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    ...(withDate
      ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
      : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${body} (${zone}, ${timezoneAbbr(iso, zone)})`;
}

/** Same instant shown in two zones so participants can cross-check. */
export function dualZone(
  iso: string | null | undefined,
  primaryTz: string | null | undefined,
  viewerTz: string,
): { primary: string; viewer: string | null } {
  if (!iso) return { primary: "—", viewer: null };
  const primary = formatInZone(iso, primaryTz);
  const zone = safeZone(primaryTz);
  if (zone === safeZone(viewerTz)) return { primary, viewer: null };
  return { primary, viewer: formatInZone(iso, viewerTz) };
}

export function isPast(iso: string | null | undefined, graceMinutes = 0): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now() - graceMinutes * 60_000;
}

export function isExpired(availabilityExpiresAt: string | null | undefined): boolean {
  if (!availabilityExpiresAt) return false;
  return new Date(availabilityExpiresAt).getTime() < Date.now();
}

/** Proposed slots that are still valid to pick right now. */
export function liveSlots(
  proposed: string[],
  availabilityExpiresAt?: string | null,
): string[] {
  if (isExpired(availabilityExpiresAt)) return [];
  return proposed.filter((s) => !isPast(s, -5));
}

export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

/**
 * Google Calendar link containing only the minimum required data:
 * neutral title, times, and (when present) the meeting location/URL.
 * Never embeds candidate email, phone, notes or internal scores.
 */
export function calendarLink(args: {
  title: string;
  startIso: string;
  durationMinutes: number;
  location?: string | null;
  details?: string | null;
}): string {
  const start = new Date(args.startIso);
  const end = new Date(start.getTime() + args.durationMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: args.title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (args.location) p.set("location", args.location);
  if (args.details) p.set("details", args.details);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Calendly deep link with safe, non-identifying role context only. */
export function calendlyLink(
  baseUrl: string,
  ctx: { positionTitle?: string | null; reference?: string | null; returnTo?: string },
): string | null {
  try {
    const url = new URL(baseUrl);
    if (!/(^|\.)calendly\.com$/.test(url.hostname)) return null;
    if (ctx.reference) url.searchParams.set("utm_content", ctx.reference);
    if (ctx.positionTitle) url.searchParams.set("utm_campaign", ctx.positionTitle.slice(0, 80));
    url.searchParams.set("utm_source", "taasflow");
    if (ctx.returnTo) url.searchParams.set("utm_term", ctx.returnTo);
    return url.toString();
  } catch {
    return null;
  }
}
