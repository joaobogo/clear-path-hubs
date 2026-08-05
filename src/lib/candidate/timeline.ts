/**
 * The candidate-facing timeline.
 *
 * Rules:
 *   1. Every entry traces to a stored row: the application itself, the CV file,
 *      recorded stage history, recorded interviews, or the withdrawal stamp.
 *      Nothing is projected and nothing describes a future step.
 *   2. Internal recruiter activity never appears — no views, no notes, no
 *      scoring or processing steps, no actor names.
 *   3. Only these ten events exist. A stage with no candidate meaning is
 *      dropped rather than renamed.
 */

export const CANDIDATE_TIMELINE_LABELS = [
  "Applied",
  "CV received",
  "Review started",
  "Shared with the employer",
  "Interview scheduled",
  "Reschedule requested",
  "Interview cancelled",
  "Interview completed",
  "Decision recorded",
  "Withdrawn",
] as const;

export type CandidateTimelineLabel = (typeof CANDIDATE_TIMELINE_LABELS)[number];

export interface CandidateTimelineEvent {
  /** ISO timestamp of the stored row. */
  at: string;
  label: CandidateTimelineLabel;
}

/** Recorded stage → candidate label. Unmapped stages are intentionally dropped. */
function labelForStage(stage: string): CandidateTimelineLabel | null {
  switch (stage) {
    case "reviewing":
      return "Review started";
    case "delivered":
      return "Shared with the employer";
    case "interview_process":
      return "Interview scheduled";
    case "offer":
    case "hired":
    case "rejected":
    case "declined":
      return "Decision recorded";
    default:
      // new, shortlisted, sourced, screening and anything internal.
      return null;
  }
}

export interface TimelineInputs {
  appliedAt: string;
  /** The CV attached to this application, when we actually received a file. */
  cv: { uploaded_at: string; received: boolean } | null;
  /** Recorded rows from candidate_stage_history for this application's match. */
  stageHistory: Array<{ to_stage: string; created_at: string }>;
  /** Recorded interviews. */
  interviews: Array<{
    status: string;
    scheduled_at: string | null;
    cancelled_at?: string | null;
    /** Candidate's own reply, when they gave one. */
    candidate_response?: string | null;
    candidate_response_at?: string | null;
  }>;
  withdrawnAt: string | null;
}

export function buildCandidateTimeline(input: TimelineInputs): CandidateTimelineEvent[] {
  const events: CandidateTimelineEvent[] = [{ at: input.appliedAt, label: "Applied" }];

  if (input.cv?.received) {
    events.push({ at: input.cv.uploaded_at, label: "CV received" });
  }

  for (const row of input.stageHistory) {
    const label = labelForStage(row.to_stage);
    if (label) events.push({ at: row.created_at, label });
  }

  for (const i of input.interviews) {
    if (i.scheduled_at && !i.cancelled_at) {
      events.push({ at: i.scheduled_at, label: "Interview scheduled" });
    }
    if (i.status === "completed" && i.scheduled_at) {
      events.push({ at: i.scheduled_at, label: "Interview completed" });
    }
    // A candidate-initiated change is recorded from the stored reply stamp.
    if (i.candidate_response === "reschedule_requested" && i.candidate_response_at) {
      events.push({ at: i.candidate_response_at, label: "Reschedule requested" });
    }
    if (i.cancelled_at) {
      events.push({ at: i.cancelled_at, label: "Interview cancelled" });
    }
  }

  if (input.withdrawnAt) events.push({ at: input.withdrawnAt, label: "Withdrawn" });

  // De-duplicate identical label+day pairs so one move never reads twice.
  const seen = new Set<string>();
  return events
    .filter((e) => {
      const key = `${e.label}|${e.at.slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Date in the reader's own time zone. Dates only — no invented precision. */
export function formatTimelineDate(at: string): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
