// One reconciliation of the client Interviews page: an interview record appears
// in exactly one bucket, and superseded records for the same candidate are not
// shown twice (once as "Needs times" and again as "Cancelled").
import { liveSlots } from "@/lib/scheduling";

type BucketRow = {
  id: string;
  status: string;
  candidate_match_id?: string | null;
  requested_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
  proposed_times?: string[] | null;
  availability_expires_at?: string | null;
};

function stamp(iv: BucketRow): number {
  const iso = iv.scheduled_at ?? iv.requested_at ?? iv.created_at ?? null;
  const t = iso ? new Date(iso).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/** True when the client can still pick one of the proposed times. */
export function hasConfirmableSlots(iv: BucketRow, now: Date = new Date()): boolean {
  void now;
  return liveSlots(iv.proposed_times ?? [], iv.availability_expires_at ?? null).length > 0;
}

/**
 * Rank within one candidate: a live request beats a stale one, and any active
 * record beats a cancelled record. Highest wins.
 */
function rank(iv: BucketRow): number {
  if (iv.status === "cancelled") return 0;
  if (iv.status === "completed") return 1;
  if (iv.status === "scheduled") return 4;
  return hasConfirmableSlots(iv) ? 3 : 2;
}

/**
 * The records worth showing: one per candidate match, keeping the record that
 * actually reflects where that candidate stands. Rows without a match id are
 * always kept.
 */
export function currentInterviewRecords<T extends BucketRow>(interviews: T[]): T[] {
  const best = new Map<string, T>();
  const loose: T[] = [];
  for (const iv of interviews) {
    const key = iv.candidate_match_id ?? null;
    if (!key) {
      loose.push(iv);
      continue;
    }
    const prev = best.get(key);
    if (
      !prev ||
      rank(iv) > rank(prev) ||
      (rank(iv) === rank(prev) && stamp(iv) > stamp(prev))
    ) {
      best.set(key, iv);
    }
  }
  return [...best.values(), ...loose];
}
