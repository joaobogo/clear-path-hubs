/**
 * Everything a candidate needs to actually attend a confirmed interview.
 *
 * Rules this module exists to enforce:
 *   1. Nothing is invented. A join link, an address, a duration or a person is
 *      only described when the interview record actually carries it. There is
 *      no "details to follow" line when the details already exist, and no
 *      dial-in wording for a video call that has none.
 *   2. Times are always rendered in the candidate's own zone with the offset,
 *      via `formatInZone`.
 *   3. A map link is only produced for something that looks like a real street
 *      address — never for a room name or a URL pasted into `location`.
 *   4. The calendar file is a plain .ics with UTC stamps, so it lands at the
 *      right moment on iOS and Android whatever the device zone is.
 */

import { formatInZone } from "@/lib/scheduling";

export type AttendFormat = "video" | "phone" | "in_person" | "unknown";

export interface AttendPerson {
  /** Role label, e.g. "Hiring manager". Always present. */
  role: string | null;
  /** Name, only when the organisation released it to the candidate. */
  name: string | null;
}

export interface AttendDetails {
  format: AttendFormat;
  /** "Video call · 45 minutes", or just one part when only one is known. */
  formatLine: string;
  whenLine: string;
  durationMinutes: number | null;
  /** A real join URL for this candidate on this interview, or null. */
  joinUrl: string | null;
  /** A physical place, when one is stored and it is not a URL. */
  address: string | null;
  /** Map link, only when the address looks like a real street address. */
  mapUrl: string | null;
  people: AttendPerson[];
  /** Plain, factual preparation notes for this format. Never speculative. */
  prepare: string[];
}

const FORMAT_LABEL: Record<string, string> = {
  phone_screen: "Phone call",
  video: "Video call",
  onsite: "In person",
  technical: "Technical interview",
  panel: "Panel interview",
  final: "Final interview",
  other: "Interview",
};

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function classifyFormat(interviewType: string | null, hasJoinUrl: boolean, hasAddress: boolean): AttendFormat {
  if (interviewType === "video") return "video";
  if (interviewType === "phone_screen") return "phone";
  if (interviewType === "onsite") return "in_person";
  if (hasJoinUrl) return "video";
  if (hasAddress) return "in_person";
  return "unknown";
}

/**
 * A street address has a number and at least one comma-separated part beyond
 * the street. Room names ("Meeting room 4") and cities alone do not qualify,
 * so they render as text without a misleading map link.
 */
export function looksLikeStreetAddress(value: string): boolean {
  const v = value.trim();
  if (v.length < 8 || isUrl(v)) return false;
  const parts = v.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 && /\d/.test(v);
}

export function mapUrlFor(address: string): string | null {
  if (!looksLikeStreetAddress(address)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

const PREPARE: Record<AttendFormat, string[]> = {
  video: [
    "Open the link a few minutes early to check your camera and microphone.",
    "Find somewhere quiet with a stable connection.",
  ],
  phone: ["Find somewhere quiet with good signal.", "Keep your phone charged and off silent."],
  in_person: ["Aim to arrive about ten minutes early.", "Bring photo ID if the building needs it."],
  unknown: [],
};

export interface AttendInput {
  interviewType: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  meetingUrl: string | null;
  location: string | null;
  people: AttendPerson[];
  viewerTz: string;
}

export function buildAttendDetails(input: AttendInput): AttendDetails {
  const joinUrl = input.meetingUrl && isUrl(input.meetingUrl) ? input.meetingUrl.trim() : null;
  const rawLocation = input.location?.trim() ?? "";
  // A URL pasted into `location` is a join link, not a place.
  const locationIsUrl = rawLocation !== "" && isUrl(rawLocation);
  const address = rawLocation !== "" && !locationIsUrl ? rawLocation : null;
  const resolvedJoin = joinUrl ?? (locationIsUrl ? rawLocation : null);
  const format = classifyFormat(input.interviewType, Boolean(resolvedJoin), Boolean(address));

  const formatParts: string[] = [];
  if (input.interviewType) formatParts.push(FORMAT_LABEL[input.interviewType] ?? input.interviewType);
  if (input.durationMinutes) formatParts.push(`${input.durationMinutes} minutes`);

  const people = input.people
    .map((p) => ({
      role: p.role?.trim() ? p.role.trim() : null,
      name: p.name?.trim() ? p.name.trim() : null,
    }))
    .filter((p) => p.role || p.name);

  return {
    format,
    formatLine: formatParts.join(" · "),
    whenLine: formatInZone(input.scheduledAt, input.viewerTz),
    durationMinutes: input.durationMinutes,
    joinUrl: resolvedJoin,
    address,
    mapUrl: address ? mapUrlFor(address) : null,
    people,
    prepare: PREPARE[format],
  };
}

export function personLine(p: AttendPerson): string {
  if (p.name && p.role) return `${p.name} — ${p.role}`;
  return p.name ?? p.role ?? "";
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    chunks.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest) chunks.push(` ${rest}`);
  return chunks.join("\r\n");
}

/**
 * Minimal RFC 5545 event. UTC timestamps only, so the calendar app places it
 * at the correct local moment on any device. Carries no candidate PII.
 */
export function buildIcs(args: {
  uid: string;
  title: string;
  startIso: string;
  durationMinutes: number | null;
  location?: string | null;
  url?: string | null;
  description?: string | null;
}): string {
  const start = new Date(args.startIso);
  const end = new Date(start.getTime() + (args.durationMinutes ?? 60) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaaSFlow//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${args.uid}@taasflow.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(args.title)}`,
    ...(args.location ? [`LOCATION:${icsEscape(args.location)}`] : []),
    ...(args.url ? [`URL:${args.url}`] : []),
    ...(args.description ? [`DESCRIPTION:${icsEscape(args.description)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n");
}

export function icsFilename(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "interview"}.ics`;
}

export const ATTEND_COPY = {
  empty: "Details will appear here once confirmed.",
  error: "We couldn't load the interview details just now. Your interview is unchanged.",
  heading: "Attending your interview",
  prepareHeading: "What to prepare",
} as const;
