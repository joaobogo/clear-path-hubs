/**
 * Candidate-facing interview slot model.
 *
 * Rules this module exists to enforce:
 *   1. Every time is rendered in the candidate's own time zone with the offset
 *      stated. No raw UTC, ever.
 *   2. A slot that has passed, or whose response deadline has passed, is
 *      returned as `held: false` — disabled and labelled, never hidden and
 *      never presented as available.
 *   3. Accepting one slot releases the others: they come back as `released`.
 *   4. Nothing is invented. Duration, format, people and deadline are only
 *      described when the interview record actually carries them.
 */

import { formatInZone, isExpired, isPast, viewerTimezone } from "@/lib/scheduling";

export type SlotState = "available" | "accepted" | "released" | "passed" | "deadline_passed";

export interface CandidateSlot {
  iso: string;
  state: SlotState;
  /** Can the candidate still take this slot with one tap? */
  held: boolean;
  /** Full sentence in the candidate's zone, offset included. */
  label: string;
  /** Why it cannot be taken, in plain words. Null when it can. */
  unavailableReason: string | null;
  /** Accessible button name: includes date, time and time zone. */
  accessibleName: string;
}

const NO_LONGER_HELD = "This time is no longer held";

export interface SlotInput {
  proposedTimes: string[];
  availabilityExpiresAt: string | null;
  /** The slot the candidate already accepted, when there is one. */
  acceptedTime: string | null;
  /** The candidate's reply, when they have given one. */
  candidateResponse: string | null;
  /** IANA zone to render in. Defaults to the viewer's own zone. */
  viewerTz?: string;
}

export function buildCandidateSlots(input: SlotInput): CandidateSlot[] {
  const tz = input.viewerTz ?? viewerTimezone();
  const deadlinePassed = isExpired(input.availabilityExpiresAt);
  const accepted = input.acceptedTime;

  return [...new Set(input.proposedTimes.filter(Boolean))]
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((iso) => {
      const label = formatInZone(iso, tz);
      let state: SlotState = "available";
      if (accepted && iso === accepted) state = "accepted";
      else if (accepted) state = "released";
      else if (isPast(iso, -5)) state = "passed";
      else if (deadlinePassed) state = "deadline_passed";

      const held = state === "available";
      const unavailableReason =
        state === "accepted"
          ? null
          : state === "released"
            ? "Released — you chose another time"
            : state === "passed" || state === "deadline_passed"
              ? NO_LONGER_HELD
              : null;

      return {
        iso,
        state,
        held,
        label,
        unavailableReason,
        accessibleName: held
          ? `Accept ${label}`
          : state === "accepted"
            ? `Confirmed: ${label}`
            : `${label} — ${unavailableReason ?? NO_LONGER_HELD}`,
      };
    });
}

/** Response deadline sentence, or null when the interview carries no deadline. */
export function slotDeadlineLine(
  availabilityExpiresAt: string | null,
  viewerTz?: string,
): string | null {
  if (!availabilityExpiresAt) return null;
  const tz = viewerTz ?? viewerTimezone();
  const when = formatInZone(availabilityExpiresAt, tz);
  return isExpired(availabilityExpiresAt)
    ? `These times were held until ${when}.`
    : `Please reply by ${when}.`;
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

/** Human format line: "Video call · 45 minutes". */
export function formatAndDuration(
  interviewType: string | null,
  durationMinutes: number | null,
): string {
  const parts: string[] = [];
  if (interviewType) parts.push(FORMAT_LABEL[interviewType] ?? interviewType);
  if (durationMinutes) parts.push(`${durationMinutes} minutes`);
  return parts.join(" · ");
}

/**
 * Who the candidate will meet, by role only. Names and emails of interviewers
 * are not part of the candidate view.
 */
export function meetingRolesLine(roles: string[]): string | null {
  const cleaned = [...new Set(roles.map((r) => r.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  return `You'll meet: ${cleaned.join(", ")}`;
}
