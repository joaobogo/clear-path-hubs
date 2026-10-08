/**
 * In-flight interviews booked before scheduling was removed must not vanish
 * silently. The candidate sees the next future one, read-only: when it is and,
 * if one was stored, the join link. No actions.
 */
export type LegacyInterviewRow = {
  status?: string | null;
  scheduled_at?: string | null;
  meeting_url?: string | null;
  timezone?: string | null;
};

export type LegacyInterviewNote = {
  scheduled_at: string;
  timezone: string | null;
  join_url: string | null;
};

function safeHttpUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function pickLegacyInterview(
  rows: readonly LegacyInterviewRow[],
  now: number = Date.now(),
): LegacyInterviewNote | null {
  const future = rows
    .filter((r) => r.status === "scheduled" && r.scheduled_at && Date.parse(r.scheduled_at) > now)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0];
  if (!future) return null;
  return {
    scheduled_at: future.scheduled_at as string,
    timezone: future.timezone ?? null,
    join_url: safeHttpUrl(future.meeting_url),
  };
}
