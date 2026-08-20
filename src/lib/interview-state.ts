export const LIVE_INTERVIEW_STATUSES = ["requested", "scheduling", "scheduled"] as const;

type InterviewStateRow = {
  status?: string | null;
  proposed_times?: unknown;
  scheduled_at?: string | null;
  availability_expires_at?: string | null;
};

function hasFutureProposedTime(value: unknown, now: number): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((slot) => {
    if (typeof slot !== "string") return false;
    const at = new Date(slot).getTime();
    return Number.isFinite(at) && at > now;
  });
}

/** One definition used by request guards, candidate actions, and the interview picker. */
export function isActiveInterview(row: InterviewStateRow, now: number = Date.now()): boolean {
  if (row.status === "scheduled") return true;
  if (row.status !== "requested" && row.status !== "scheduling") return false;

  const expiresAt = row.availability_expires_at
    ? new Date(row.availability_expires_at).getTime()
    : null;
  if (expiresAt !== null && Number.isFinite(expiresAt) && expiresAt <= now) return false;

  return hasFutureProposedTime(row.proposed_times, now);
}