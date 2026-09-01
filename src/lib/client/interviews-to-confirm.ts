// One definition of "this interview is waiting on you to confirm a time".
// The home page rows, the Roles page banner and the Interviews page section all
// read from here, so the three counts can never drift apart.

export const CONFIRMATION_PENDING_STATUSES = ["requested", "scheduling"] as const;

/** Statuses meaning the interview did not go ahead. */
export const INTERVIEW_CALLED_OFF_STATUSES = ["cancelled", "no_show"] as const;

/** Statuses meaning an interview was held, or is still live. */
export const INTERVIEW_HELD_OR_LIVE_STATUSES = [
  "requested",
  "scheduling",
  "proposed",
  "scheduled",
  "completed",
] as const;

/**
 * True when every interview on a match was called off and none was held.
 *
 * A cancellation does not move the stage, so a match sits at
 * interview_process with nothing live. Two surfaces then disagreed: the row
 * label, computed from interview status, correctly read "Interview
 * cancelled", while the INTERVIEWING tile — computed from the stage alone —
 * counted the same person. One person interviewing, tile said two
 * (audit 1 Sep, F6).
 *
 * A COMPLETED interview is emphatically not this: a candidate whose interview
 * was held is still in the interview stage, awaiting feedback or a decision.
 */
/**
 * True when an interview was actually HELD.
 *
 * "Make offer" was derived from the stage alone, so Marta Nunes — stage
 * interview_process, one interview still awaiting a slot, none held — was
 * offered the chance to make an offer to someone the client had never met
 * (audit 1 Sep, F20b). Counting stays on the stage, as client-pipeline-lane.ts
 * documents; the ACTION needs the interview record.
 */
export function interviewHeld(statuses: readonly (string | null | undefined)[]): boolean {
  return statuses.some((s) => String(s ?? "") === "completed");
}

export function interviewCalledOffOnly(statuses: readonly (string | null | undefined)[]): boolean {
  let sawCancelled = false;
  for (const raw of statuses) {
    const status = String(raw ?? "");
    if ((INTERVIEW_HELD_OR_LIVE_STATUSES as readonly string[]).includes(status)) return false;
    if ((INTERVIEW_CALLED_OFF_STATUSES as readonly string[]).includes(status)) sawCancelled = true;
  }
  return sawCancelled;
}

/** True when an interview record still needs the client to confirm a time. */
export function interviewNeedsTimeConfirmed(status: string | null | undefined): boolean {
  if (!status) return false;
  return (CONFIRMATION_PENDING_STATUSES as readonly string[]).includes(status);
}

/** Interviews awaiting confirmation, from a list of interview records. */
export function interviewsAwaitingConfirmation<T extends { status: string }>(interviews: T[]): T[] {
  return interviews.filter((iv) => interviewNeedsTimeConfirmed(iv.status));
}

/**
 * Same count, derived from candidate KPI rows. `interview_needs_confirmation`
 * is set from exactly the statuses above, and deliberately ignores the
 * candidate's stage — an interview can be requested before the candidate is
 * moved into the interviewing lane.
 */
export function countRowsAwaitingConfirmation(
  rows: Array<{ interview_needs_confirmation: boolean }>,
): number {
  return rows.filter((row) => row.interview_needs_confirmation).length;
}
