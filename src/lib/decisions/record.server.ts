/**
 * The one writer for `client_decisions`.
 *
 * A decision is recorded once. When the same decision, with the same feedback
 * and reason, is already the candidate's latest standing decision, the write is
 * skipped instead of appended — so a double-submitted button, a retried job or
 * a re-run of a transition path cannot leave a repeating history behind or push
 * "decisions this week" past the number of candidates.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type ClientDecisionWrite = {
  candidate_match_id: string;
  organization_id: string;
  decision: string;
  feedback?: string | null;
  reason_code?: string | null;
  actor_user_id?: string | null;
  from_stage?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
};

/** Identical decisions recorded closer together than this are one decision. */
const REPEAT_GAP_MS = 30 * 60_000;

export async function recordClientDecision(
  client: AnyClient,
  row: ClientDecisionWrite,
): Promise<{ inserted: boolean }> {
  const feedback = row.feedback?.trim() || null;
  const reasonCode = row.reason_code ?? null;

  const { data: latest } = await client
    .from("client_decisions")
    .select("id, decision, feedback, reason_code, created_at")
    .eq("candidate_match_id", row.candidate_match_id)
    .eq("organization_id", row.organization_id)
    .is("reversed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) {
    const sameDecision =
      String(latest.decision) === row.decision &&
      ((latest.feedback as string | null)?.trim() || null) === feedback &&
      ((latest.reason_code as string | null) ?? null) === reasonCode;
    const recent = Date.now() - Date.parse(String(latest.created_at)) < REPEAT_GAP_MS;
    // The standing decision is unchanged: nothing new happened to record.
    if (sameDecision && recent) return { inserted: false };
    if (sameDecision) return { inserted: false };
  }

  await client.from("client_decisions").insert({
    candidate_match_id: row.candidate_match_id,
    organization_id: row.organization_id,
    decision: row.decision as never,
    feedback,
    reason_code: reasonCode,
    actor_user_id: row.actor_user_id ?? null,
    from_stage: row.from_stage ?? null,
    details: (row.details ?? null) as never,
  } as never);
  return { inserted: true };
}
