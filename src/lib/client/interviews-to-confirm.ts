// One definition of "this interview is waiting on you to confirm a time".
// The home page rows, the Roles page banner and the Interviews page section all
// read from here, so the three counts can never drift apart.

export const CONFIRMATION_PENDING_STATUSES = ["requested", "scheduling"] as const;

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

export function awaitingConfirmationHeading(count: number): string {
  return count === 1
    ? "Waiting on you to confirm a time"
    : "Waiting on you to confirm a time";
}
