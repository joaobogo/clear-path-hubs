// Prompt 10 — interview scheduling without email tennis.
// Browser-safe rules shared by the inline slot proposer and the server, so the
// form and the API agree on what a valid proposal is.

import { isValidTimezone, timezoneAbbr } from "./scheduling";
import { zonedWallClockToIso } from "./availability";

/** Formats the client can pick. Kept to the three real-world options. */
export const PROPOSAL_FORMATS = [
  { value: "video_call", label: "Video", hint: "We send the meeting link" },
  { value: "phone_screen", label: "Phone", hint: "We share the number" },
  { value: "onsite", label: "On-site", hint: "Add the address in notes" },
] as const;
export type ProposalFormat = (typeof PROPOSAL_FORMATS)[number]["value"];

export const DURATION_OPTIONS = [30, 45, 60, 90] as const;

/** Slot rules — the same numbers the server enforces. */
export const MIN_SLOTS = 2;
export const MAX_SLOTS = 3;
export const MIN_NOTICE_HOURS = 24;
/** A minute of slack so a slot chosen right on the boundary still passes. */
const NOTICE_GRACE_MS = 60_000;

export type ProposalAttendee = { name: string; email: string; role?: string };

export type ProposalDraft = {
  format: ProposalFormat;
  durationMinutes: number;
  timezone: string;
  /** `datetime-local` values, interpreted in `timezone`. */
  slots: string[];
  attendees: ProposalAttendee[];
  notes?: string;
};

export type ProposalErrors = {
  slots?: string;
  slotAt?: Record<number, string>;
  attendees?: string;
  attendeeAt?: Record<number, string>;
  timezone?: string;
  duration?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function emptyProposal(timezone: string): ProposalDraft {
  return {
    format: "video_call",
    durationMinutes: 45,
    timezone,
    slots: ["", "", ""],
    attendees: [{ name: "", email: "" }],
  };
}

/**
 * Convert a `datetime-local` value ("2026-08-12T14:30") into an instant, read
 * as wall-clock time in `timezone` — never in the browser's own zone.
 */
export function localToIso(local: string, timezone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, min] = m;
  try {
    return zonedWallClockToIso(
      Number(y),
      Number(mo),
      Number(d),
      Number(h) * 60 + Number(min),
      isValidTimezone(timezone) ? timezone : "UTC",
    );
  } catch {
    return null;
  }
}

/** The earliest instant a proposed slot may start. */
export function earliestSlotMs(now = Date.now()): number {
  return now + MIN_NOTICE_HOURS * 3600_000 - NOTICE_GRACE_MS;
}

/** "GMT+1" style label so a proposed time is never ambiguous. */
export function zoneLabel(timezone: string, referenceIso?: string | null): string {
  const iso = referenceIso ?? new Date().toISOString();
  return `${timezone} (${timezoneAbbr(iso, timezone)})`;
}

export type ProposalResult = {
  errors: ProposalErrors;
  valid: boolean;
  /** Deduped, sorted ISO instants — only meaningful when `valid`. */
  slotsIso: string[];
  attendees: ProposalAttendee[];
};

export function validateProposal(draft: ProposalDraft, now = Date.now()): ProposalResult {
  const errors: ProposalErrors = {};
  const slotAt: Record<number, string> = {};
  const attendeeAt: Record<number, string> = {};
  const earliest = earliestSlotMs(now);

  if (!isValidTimezone(draft.timezone)) {
    errors.timezone = "Choose a valid timezone.";
  }
  if (
    !Number.isInteger(draft.durationMinutes) ||
    draft.durationMinutes < 15 ||
    draft.durationMinutes > 480
  ) {
    errors.duration = "Duration must be between 15 and 480 minutes.";
  }

  const seen = new Map<string, number>();
  const slotsIso: string[] = [];
  draft.slots.forEach((raw, i) => {
    const value = raw.trim();
    if (!value) return;
    const iso = localToIso(value, draft.timezone);
    if (!iso) {
      slotAt[i] = "That isn't a valid date and time.";
      return;
    }
    const ms = new Date(iso).getTime();
    if (ms < earliest) {
      slotAt[i] = `Slots must be at least ${MIN_NOTICE_HOURS} hours from now.`;
      return;
    }
    if (seen.has(iso)) {
      slotAt[i] = "You already proposed this time.";
      return;
    }
    seen.set(iso, i);
    slotsIso.push(iso);
  });

  if (slotsIso.length < MIN_SLOTS) {
    errors.slots = `Propose at least ${MIN_SLOTS} future times.`;
  } else if (slotsIso.length > MAX_SLOTS) {
    errors.slots = `Propose no more than ${MAX_SLOTS} times.`;
  }

  const attendees: ProposalAttendee[] = [];
  draft.attendees.forEach((a, i) => {
    const name = a.name.trim();
    const email = a.email.trim();
    if (!name && !email) return;
    if (!isEmail(email)) {
      attendeeAt[i] = "Enter a valid email address.";
      return;
    }
    attendees.push({
      name: name || email,
      email,
      ...(a.role?.trim() ? { role: a.role.trim() } : {}),
    });
  });
  if (attendees.length === 0) {
    errors.attendees = "Add at least one attendee with an email address.";
  }

  if (Object.keys(slotAt).length > 0) errors.slotAt = slotAt;
  if (Object.keys(attendeeAt).length > 0) errors.attendeeAt = attendeeAt;

  const valid = Object.keys(errors).length === 0;
  return { errors, valid, slotsIso: slotsIso.sort(), attendees };
}

/** Server-side gate. Throws the message the UI maps to a plain sentence. */
export function assertProposedSlots(isoSlots: string[], now = Date.now()): string[] {
  const unique = Array.from(new Set(isoSlots)).sort();
  if (unique.length !== isoSlots.length) throw new Error("duplicate_slot");
  if (unique.length < MIN_SLOTS) throw new Error("too_few_slots");
  if (unique.length > MAX_SLOTS) throw new Error("too_many_slots");
  const earliest = earliestSlotMs(now);
  for (const iso of unique) {
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) throw new Error("invalid_slot");
    if (ms < earliest) throw new Error("slot_too_soon");
  }
  return unique;
}

/** One sentence per failure code — never a raw error string in the UI. */
export function proposalErrorMessage(code: string): string {
  switch (code) {
    case "too_few_slots":
      return `Propose at least ${MIN_SLOTS} future times.`;
    case "too_many_slots":
      return `Propose no more than ${MAX_SLOTS} times.`;
    case "duplicate_slot":
      return "Two of those times are the same.";
    case "slot_too_soon":
      return `Every slot must be at least ${MIN_NOTICE_HOURS} hours from now.`;
    case "invalid_slot":
      return "One of those times isn't a valid date.";
    case "invalid_timezone":
      return "That timezone isn't recognised.";
    case "invalid_attendee_email":
      return "One of the attendee emails isn't valid.";
    case "interview_already_active":
      return "This candidate already has an interview in progress.";
    case "forbidden":
      return "You don't have permission to propose times.";
    case "SUPPORT_VIEW_READ_ONLY":
      return "Support view is read-only.";
    default:
      return "We couldn't send your proposal. Nothing was saved — try again.";
  }
}
