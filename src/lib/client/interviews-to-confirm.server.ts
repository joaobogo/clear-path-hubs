/**
 * The one query behind "interviews that still need a time".
 *
 * The Roles banner, the Overview queue and the Interviews page all read this,
 * so the three numbers can never disagree. Semantics match the Roles banner:
 * one entry per candidate match, the earliest pending interview wins.
 */
import { CONFIRMATION_PENDING_STATUSES } from "@/lib/client/interviews-to-confirm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type PendingConfirmationInterview = {
  interview_id: string;
  candidate_match_id: string;
  position_id: string | null;
  status: string;
  requested_at: string | null;
  proposed_times: string[];
};

export async function loadInterviewsAwaitingConfirmation(
  supabase: AnyRow,
  orgId: string,
): Promise<PendingConfirmationInterview[]> {
  const { data } = await supabase
    .from("interviews")
    .select(
      "id, candidate_match_id, position_id, status, requested_at, created_at, proposed_times",
    )
    .eq("organization_id", orgId)
    .in("status", CONFIRMATION_PENDING_STATUSES as unknown as string[]);

  const byMatch = new Map<string, PendingConfirmationInterview>();
  for (const row of ((data as AnyRow[]) ?? [])) {
    const matchId = row.candidate_match_id as string | null;
    if (!matchId) continue;
    const requested = (row.requested_at ?? row.created_at ?? null) as string | null;
    const entry: PendingConfirmationInterview = {
      interview_id: row.id as string,
      candidate_match_id: matchId,
      position_id: (row.position_id as string | null) ?? null,
      status: String(row.status),
      requested_at: requested,
      proposed_times: Array.isArray(row.proposed_times) ? (row.proposed_times as string[]) : [],
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

export async function countInterviewsAwaitingConfirmation(
  supabase: AnyRow,
  orgId: string,
): Promise<number> {
  return (await loadInterviewsAwaitingConfirmation(supabase, orgId)).length;
}
