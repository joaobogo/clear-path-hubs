/**
 * notifications-resolver.server.ts
 *
 * Server-only logic that scans a user's actionable notifications and resolves
 * any whose underlying work is already complete. This is intentionally separate
 * from the `createServerFn` wrapper so it can be called inline after the
 * action that completes the work (e.g. client confirms an interview, or
 * records a decision) without an extra round-trip.
 *
 * The function is idempotent and safe to call repeatedly: it only marks rows
 * that still have `resolved_at IS NULL`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type ResolveResult = { resolved: number };

const ACTIONABLE_EVENT_TYPES = [
  "approval_needed",
  "interview_requested",
  "interview_rescheduled",
] as const;

/**
 * Resolve any notifications for the given user whose real-world condition has
 * cleared. Currently handles:
 *  - approval_needed (candidate_match): resolved once a client_decisions row
 *    exists for the match.
 *  - interview_requested / interview_rescheduled (candidate_match): resolved
 *    when the related interview is no longer in a state that needs confirmation
 *    (i.e. not `requested` or `scheduling`).
 */
export async function resolveNotificationsForUser(
  admin: { from: (table: string) => AnyRow },
  userId: string,
): Promise<ResolveResult> {
  const { data: notifications, error } = await admin
    .from("notifications")
    .select("id, event_type, entity_type, entity_id")
    .eq("recipient_user_id", userId)
    .in("event_type", ACTIONABLE_EVENT_TYPES)
    .is("resolved_at", null);

  if (error || !notifications || notifications.length === 0) {
    return { resolved: 0 };
  }

  const resolvedIds: string[] = [];

  for (const n of notifications as AnyRow[]) {
    const entityId = n.entity_id as string | null;
    if (!entityId) continue;

    if (n.event_type === "approval_needed" && n.entity_type === "candidate_match") {
      const { data: decision } = await admin
        .from("client_decisions")
        .select("id")
        .eq("candidate_match_id", entityId)
        .limit(1)
        .maybeSingle();
      if (decision) {
        resolvedIds.push(n.id as string);
      }
      continue;
    }

    if (
      (n.event_type === "interview_requested" || n.event_type === "interview_rescheduled") &&
      n.entity_type === "candidate_match"
    ) {
      const { data: openInterview } = await admin
        .from("interviews")
        .select("id")
        .eq("candidate_match_id", entityId)
        .in("status", ["requested", "scheduling"])
        .limit(1)
        .maybeSingle();
      if (!openInterview) {
        resolvedIds.push(n.id as string);
      }
      continue;
    }
  }

  if (resolvedIds.length > 0) {
    const now = new Date().toISOString();
    await admin
      .from("notifications")
      .update({ resolved_at: now, read_at: now } as AnyRow)
      .in("id", resolvedIds);
  }

  return { resolved: resolvedIds.length };
}
