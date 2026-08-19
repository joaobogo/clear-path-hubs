export type InterviewStatus =
  | "requested"
  | "scheduling"
  | "scheduled"
  | "completed"
  | "cancelled";

/**
 * One derivation of "has this interview happened yet?" and one vocabulary for
 * its status, shared by the timeline card, the detail modal, the feedback queue
 * and the server guards.
 *
 * Classification is strictly temporal: it compares the scheduled datetime with
 * now and never reads `status`. A meeting three days in the future cannot have
 * happened, whatever a row says — that mismatch is what put a future interview
 * under "Already happened" with a Join link.
 */

export type InterviewOccurrence = "upcoming" | "happened" | "unscheduled" | "cancelled";

type TimingRow = {
  status: InterviewStatus | string;
  scheduled_at?: string | null;
};

function timeOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

export function interviewOccurrence(
  iv: TimingRow,
  now: number = Date.now(),
): InterviewOccurrence {
  if (iv.status === "cancelled") return "cancelled";
  const at = timeOf(iv.scheduled_at);
  if (at === null) return "unscheduled";
  return at < now ? "happened" : "upcoming";
}

/** True only for interviews whose scheduled time is in the past. */
export function hasInterviewHappened(iv: TimingRow, now: number = Date.now()): boolean {
  return timeOf(iv.scheduled_at) !== null && timeOf(iv.scheduled_at)! < now;
}

/**
 * The status a viewer may be shown. `completed` on a future meeting is
 * impossible, so it degrades to `scheduled` rather than lying on the card.
 */
export function displayInterviewStatus(
  iv: TimingRow,
  now: number = Date.now(),
): InterviewStatus {
  const status = iv.status as InterviewStatus;
  if (status === "completed" && !hasInterviewHappened(iv, now)) return "scheduled";
  return status;
}

const LABELS: Record<string, string> = {
  requested: "Needs times",
  scheduling: "Times sent — awaiting reply",
  scheduled: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Card and modal must read the same words for the same record. */
export function interviewStatusLabel(
  iv: TimingRow,
  now: number = Date.now(),
): string {
  return LABELS[displayInterviewStatus(iv, now)] ?? "Scheduled";
}

/** A Join link only makes sense for a meeting that has not happened yet. */
export function canJoinInterview(
  iv: TimingRow & { meeting_url?: string | null },
  now: number = Date.now(),
): boolean {
  if (!iv.meeting_url) return false;
  const at = timeOf(iv.scheduled_at);
  if (at === null) return false;
  // Joinable from 15 minutes before until 2 hours after the start.
  return now >= at - 15 * 60 * 1000 && now <= at + 2 * 60 * 60 * 1000;
}
