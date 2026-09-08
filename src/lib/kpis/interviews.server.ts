/**
 * Interview figures — the one reader each.
 *
 *  - "awaiting a time": an interview record whose status still asks the client
 *    to pick a slot. One entry per candidate match, earliest request wins.
 *  - "held in a window": recorded complete inside the window, or scheduled
 *    inside the window at a time already past and not cancelled.
 *
 * Interview-level visibility narrows rows to assigned interviewers, which is
 * why both figures read through the organization-scoped reader — otherwise a
 * client's own interviews silently vanish from their own count.
 */
import { readOrgRows } from "@/lib/kpis/org-read.server";
import { CONFIRMATION_PENDING_STATUSES } from "@/lib/client/interviews-to-confirm";
import { interviewHolder } from "@/lib/client/interview-holder";
import { WEEKLY_WINDOW_DAYS } from "@/lib/client-weekly-update";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type PendingConfirmationInterview = {
  interview_id: string;
  candidate_match_id: string;
  position_id: string | null;
  status: string;
  requested_at: string | null;
  proposed_times: string[];
  /**
   * Required to decide WHOSE move it is. Without it `interviewHolder` cannot
   * tell "slots sent and lapsed" from "slots on the table", so every caller
   * was left equating "status is pending" with "the client owes us" — which is
   * how the overview came to say "3 waiting on you" about three interviews the
   * interviews page itself labels "Waiting on TaaSFlow" (audit #9, item 13b).
   */
  availability_expires_at: string | null;
};

/**
 * The one-per-candidate rule behind every "awaiting a time" figure: a candidate
 * with two open requests is one piece of work, and the earliest request wins.
 * Admin queues that need joined rows for their previews apply this same
 * function, so their badge can never disagree with the client's count.
 */
export function dedupeAwaitingByMatch(rows: readonly AnyRow[]): PendingConfirmationInterview[] {
  const byMatch = new Map<string, PendingConfirmationInterview>();
  for (const row of rows) {
    const matchId = row.candidate_match_id as string | null;
    if (!matchId) continue;
    const requested = (row.requested_at ?? row.created_at ?? null) as string | null;
    const entry: PendingConfirmationInterview = {
      interview_id: row.id as string,
      candidate_match_id: matchId,
      position_id: (row.position_id as string | null) ?? null,
      status: String(row.status),
      requested_at: requested,
      proposed_times: Array.isArray(row.proposed_times)
        ? (row.proposed_times as string[])
        : [],
      availability_expires_at: (row.availability_expires_at as string | null) ?? null,
    };
    const prev = byMatch.get(matchId);
    if (
      !prev ||
      (entry.requested_at && prev.requested_at && entry.requested_at < prev.requested_at)
    ) {
      byMatch.set(matchId, entry);
    }
  }
  return [...byMatch.values()];
}

export async function loadInterviewsAwaitingTime(
  supabase: AnyRow,
  orgId: string,
): Promise<PendingConfirmationInterview[]> {
  const rows = await readOrgRows(
    supabase,
    orgId,
    "interviews",
    "id, candidate_match_id, position_id, status, requested_at, created_at, proposed_times, availability_expires_at",
    (q) => q.in("status", CONFIRMATION_PENDING_STATUSES as unknown as string[]),
  );
  return dedupeAwaitingByMatch(rows);
}

/**
 * Of the pending interviews, the ones the CLIENT can actually act on — live
 * slots are on the table. A client cannot confirm a time that was never sent,
 * and telling them otherwise reports our own delay as their inaction.
 */
export function awaitingClient(
  rows: readonly PendingConfirmationInterview[],
): PendingConfirmationInterview[] {
  return rows.filter((iv) => interviewHolder(iv).holder === "client");
}

/** The ones TaaSFlow owes a move on. Never client work. */
export function awaitingUs(
  rows: readonly PendingConfirmationInterview[],
): PendingConfirmationInterview[] {
  return rows.filter((iv) => interviewHolder(iv).holder === "us");
}

/**
 * The count behind every "waiting on you · confirm a time" figure.
 *
 * Counts only what the client owns. It used to count every pending interview,
 * so an interview where we had sent nothing was reported to the client as
 * theirs to confirm.
 */
export async function countInterviewsAwaitingTime(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return awaitingClient(await loadInterviewsAwaitingTime(supabase, orgId)).length;
}

export function interviewWindow(
  now: Date = new Date(),
  days: number = WEEKLY_WINDOW_DAYS,
): { startIso: string; endIso: string } {
  return {
    startIso: new Date(now.getTime() - days * 86_400_000).toISOString(),
    endIso: now.toISOString(),
  };
}

/** Interviews held inside a window, one row per interview. */
export async function loadInterviewsHeld(
  supabase: AnyRow,
  orgId: string,
  window: { startIso: string; endIso: string },
  now: Date = new Date(),
): Promise<AnyRow[]> {
  const { startIso, endIso } = window;
  const rows = await readOrgRows(
    supabase,
    orgId,
    "interviews",
    "id, position_id, candidate_match_id, status, scheduled_at, completed_at, cancelled_at, positions(title)",
    (q) =>
      q
        .or(
          `and(completed_at.gte.${startIso},completed_at.lte.${endIso}),and(scheduled_at.gte.${startIso},scheduled_at.lte.${endIso})`,
        )
        .order("scheduled_at", { ascending: true }),
  );
  const nowIso = now.toISOString();
  return rows.filter((i) => {
    if (String(i.status ?? "") === "cancelled" || i.cancelled_at) return false;
    const completed = i.completed_at ? String(i.completed_at) : null;
    if (completed && completed >= startIso && completed <= endIso) return true;
    const scheduled = i.scheduled_at ? String(i.scheduled_at) : null;
    return Boolean(
      scheduled && scheduled >= startIso && scheduled <= endIso && scheduled <= nowIso,
    );
  });
}

export async function countInterviewsHeld(
  supabase: AnyRow,
  orgId: string,
  window: { startIso: string; endIso: string },
  now: Date = new Date(),
): Promise<number> {
  return (await loadInterviewsHeld(supabase, orgId, window, now)).length;
}
