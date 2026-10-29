/**
 * A role's criteria changed through the normal save path: rescore every match
 * on it through the full pipeline, recompute eligibility, and tell the admins.
 *
 * - Staleness: database triggers already mark the position's scores stale on
 *   the write; mark_position_scores_stale is called again here so the record
 *   carries the reason even when only screening questions moved.
 * - Queue: the existing one. A match set to processing_state='ready_to_score'
 *   with rescore_queued_at is picked up by drainQueue (pipeline-runner), which
 *   runs runPipelineForMatch with force: true, exactly as the nightly
 *   freshness reconciliation does. No processing_jobs row: nothing consumes
 *   a rescore job type (see freshness-reconcile.server.ts).
 * - Eligibility: a rescore rewrites eligibility from dealbreaker answers; when
 *   a dealbreaker question itself changed, recompute_screening_eligibility
 *   (migration 0005) is applied at once as well, if it exists.
 * - Never approves, publishes or touches client_visibility.
 * - Idempotent: one notification per save (keyed on the new criteria and the
 *   save's timestamp), and a match already queued is not queued twice.
 */
import {
  describeCriteriaChange,
  rescoreSummary,
  selectMatchesToRequeue,
  type CriteriaSnapshot,
} from "./requirement-change";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type RequirementRescoreOutcome = {
  changed: boolean;
  queued: number;
  skipped: number;
  notified: number;
  eligibility_recomputed: boolean;
};

export async function rescoreAfterCriteriaChange(args: {
  admin: Any;
  positionId: string;
  organizationId: string | null;
  title: string;
  before: CriteriaSnapshot;
  after: CriteriaSnapshot;
  actorUserId: string | null;
  /** The saved row's updated_at: makes the notification key unique per save. */
  savedAt: string | null;
  trace_id: string;
}): Promise<RequirementRescoreOutcome> {
  const s = args.admin;
  const change = describeCriteriaChange(args.before, args.after);
  const none = { changed: false, queued: 0, skipped: 0, notified: 0, eligibility_recomputed: false };
  if (!change.changed) return none;

  const now = new Date().toISOString();
  const reason = change.parts.some((p) => p.startsWith("screening")) && change.parts.length === 1
    ? "screening_changed"
    : "requirements_changed";
  try {
    await s.rpc("mark_position_scores_stale", { _position_id: args.positionId, _reason: reason });
  } catch (err) {
    console.error("[requirement-rescore] mark stale failed", args.positionId, (err as Error)?.message);
  }

  const { data: matches, error } = await s
    .from("candidate_matches")
    .select("id,processing_state,stage,rescore_queued_at")
    .eq("position_id", args.positionId);
  if (error) throw new Error(`requirement_rescore_scan_failed:${error.message}`);
  const { queue, skipped } = selectMatchesToRequeue((matches ?? []) as Any[], now);

  if (queue.length > 0) {
    // The queue drainQueue reads; force:true is applied there for this state.
    const { error: qErr } = await s
      .from("candidate_matches")
      .update({ processing_state: "ready_to_score", rescore_queued_at: now })
      .in("id", queue);
    if (qErr) throw new Error(`requirement_rescore_queue_failed:${qErr.message}`);
  }

  await s.from("audit_events").insert({
    organization_id: args.organizationId,
    entity_type: "position",
    entity_id: args.positionId,
    action: "scoring.requirements_rescore_queued",
    actor_user_id: args.actorUserId,
    after_state: {
      change: change.parts,
      signature: change.signature,
      queued_match_ids: queue,
      skipped,
      queued_by: "requirements_change",
    },
    trace_id: args.trace_id,
  });

  let eligibilityRecomputed = false;
  if (change.eligibilityAffected) {
    try {
      const { error: rpcErr } = await s.rpc("recompute_screening_eligibility", {
        p_position_id: args.positionId,
        p_apply: true,
      });
      eligibilityRecomputed = !rpcErr;
      if (rpcErr) console.warn("[requirement-rescore] eligibility recompute unavailable", rpcErr.message);
    } catch (err) {
      console.warn("[requirement-rescore] eligibility recompute failed", (err as Error)?.message);
    }
  }

  const notified = await notifyAdmins(s, {
    ...args,
    signature: change.signature,
    ...rescoreSummary({ title: args.title, parts: change.parts, queued: queue.length, skipped: skipped.length }),
  });

  return {
    changed: true,
    queued: queue.length,
    skipped: skipped.length,
    notified,
    eligibility_recomputed: eligibilityRecomputed,
  };
}

async function notifyAdmins(
  s: Any,
  a: {
    positionId: string;
    organizationId: string | null;
    actorUserId: string | null;
    savedAt: string | null;
    signature: string;
    title: string;
    body: string;
  },
): Promise<number> {
  try {
    const key = `requirements_rescore:${a.positionId}:${a.signature}:${a.savedAt ?? "na"}`;
    const { data: existing } = await s
      .from("notification_events")
      .select("id")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing) return 0;
    const { data: event, error } = await s
      .from("notification_events")
      .insert({
        event_type: "position_updated",
        idempotency_key: key,
        organization_id: a.organizationId,
        position_id: a.positionId,
        actor_user_id: a.actorUserId,
        payload: { kind: "requirements_rescore", body: a.body },
      })
      .select("id")
      .single();
    if (error) return 0;
    const { data: staff } = await s
      .from("memberships")
      .select("user_id")
      .eq("status", "active")
      .in("role", ["platform_admin", "operations"]);
    const recipients = [...new Set(((staff ?? []) as Any[]).map((m) => m.user_id as string))].filter(
      (id) => id && id !== a.actorUserId,
    );
    if (recipients.length === 0) return 0;
    await s.from("notifications").insert(
      recipients.map((user_id) => ({
        recipient_user_id: user_id,
        audience: "admin",
        organization_id: a.organizationId,
        event_id: event.id,
        event_type: "position_updated",
        entity_type: "position",
        entity_id: a.positionId,
        title: a.title,
        body: a.body,
        link_path: `/admin/positions/${a.positionId}`,
      })),
    );
    return recipients.length;
  } catch (err) {
    console.error("[requirement-rescore] notify failed", a.positionId, (err as Error)?.message);
    return 0;
  }
}
