/**
 * Bulk admin operations.
 * Every operation is preview-first: the caller asks for a plan (exact counts and
 * skip reasons), then confirms. Nothing here silently mutates records the
 * operator did not see counted.
 */

import { BULK_STAGES, type BulkStage } from "./admin-bulk-constants";
export { BULK_STAGES };
export type { BulkStage };

export type BulkPlanRow = {
  match_id: string;
  candidate_name: string;
  position_title: string;
  current: string;
  eligible: boolean;
  reason?: string;
};

export type BulkPlan = {
  rows: BulkPlanRow[];
  eligible: number;
  skipped: number;
};

// Untyped admin client: these queries span many generated table types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function loadMatches(admin: Admin, matchIds: string[]) {
  const { data, error } = await admin
    .from("candidate_matches")
    .select(
      "id, stage, admin_status, client_visibility, position_id, organization_id, candidate_profile_id, candidate_profiles:candidate_profile_id(full_name), positions:position_id(title, status)",
    )
    .in("id", matchIds)
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, any>>;
}

function displayName(row: Record<string, any>) {
  return (row.candidate_profiles?.full_name as string) || "Candidate";
}

export async function planStageMove(
  admin: Admin,
  matchIds: string[],
  toStage: BulkStage,
): Promise<BulkPlan> {
  const rows = await loadMatches(admin, matchIds);
  const planned = rows.map<BulkPlanRow>((row) => {
    let reason: string | undefined;
    if (row.stage === toStage) reason = "Already at this stage";
    else if (toStage !== "not_moving_forward" && row.admin_status !== "approved")
      reason = "Not approved for release yet";
    else if (row.positions?.status === "closed") reason = "Role is closed";
    return {
      match_id: row.id as string,
      candidate_name: displayName(row),
      position_title: (row.positions?.title as string) ?? "—",
      current: row.stage as string,
      eligible: !reason,
      reason,
    };
  });
  return {
    rows: planned,
    eligible: planned.filter((r) => r.eligible).length,
    skipped: planned.filter((r) => !r.eligible).length,
  };
}

export async function applyStageMove(
  admin: Admin,
  matchIds: string[],
  toStage: BulkStage,
  actorUserId: string,
) {
  const plan = await planStageMove(admin, matchIds, toStage);
  const ids = plan.rows.filter((r) => r.eligible).map((r) => r.match_id);
  if (ids.length === 0) return { changed: 0, skipped: plan.skipped };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("candidate_matches")
    .update({ stage: toStage, updated_at: now })
    .in("id", ids);
  if (error) throw error;

  await admin.from("candidate_stage_history").insert(
    ids.map((id) => ({
      candidate_match_id: id,
      to_stage: toStage,
      changed_by: actorUserId,
      note: "Bulk stage change",
    })) as never,
  );
  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "bulk.stage_move",
    entity_type: "candidate_match",
    entity_id: ids[0],
    metadata: { match_ids: ids, to_stage: toStage, skipped: plan.skipped },
  } as never);

  return { changed: ids.length, skipped: plan.skipped };
}

export type AssignPlan = {
  rows: Array<{ candidate_profile_id: string; name: string; eligible: boolean; reason?: string }>;
  eligible: number;
  skipped: number;
  position_title: string;
};

export async function planAssign(
  admin: Admin,
  candidateProfileIds: string[],
  positionId: string,
): Promise<AssignPlan> {
  const [posRes, profilesRes, existingRes] = await Promise.all([
    admin.from("positions").select("id, title, status, organization_id").eq("id", positionId).maybeSingle(),
    admin.from("candidate_profiles").select("id, full_name").in("id", candidateProfileIds).limit(500),
    admin
      .from("candidate_matches")
      .select("candidate_profile_id")
      .eq("position_id", positionId)
      .in("candidate_profile_id", candidateProfileIds),
  ]);
  if (posRes.error) throw posRes.error;
  if (!posRes.data) throw new Error("Position not found");
  const already = new Set((existingRes.data ?? []).map((r: any) => r.candidate_profile_id as string));

  type AssignRow = { candidate_profile_id: string; name: string; eligible: boolean; reason?: string };
  const rows: AssignRow[] = (profilesRes.data ?? []).map((p: any) => {
    const reason = already.has(p.id)
      ? "Already on this role"
      : posRes.data!.status === "closed"
        ? "Role is closed"
        : undefined;
    return { candidate_profile_id: p.id as string, name: (p.full_name as string) ?? "Candidate", eligible: !reason, reason };
  });

  return {
    rows,
    eligible: rows.filter((r) => r.eligible).length,
    skipped: rows.filter((r) => !r.eligible).length,
    position_title: posRes.data.title as string,
  };
}

export async function applyAssign(
  admin: Admin,
  candidateProfileIds: string[],
  positionId: string,
  actorUserId: string,
) {
  const plan = await planAssign(admin, candidateProfileIds, positionId);
  const ids = plan.rows.filter((r) => r.eligible).map((r) => r.candidate_profile_id);
  if (ids.length === 0) return { changed: 0, skipped: plan.skipped };

  const { data: position, error: posErr } = await admin
    .from("positions")
    .select("id, organization_id")
    .eq("id", positionId)
    .single();
  if (posErr) throw posErr;

  const { data: apps, error: appErr } = await admin
    .from("applications")
    .insert(
      ids.map((cid) => ({
        candidate_profile_id: cid,
        position_id: positionId,
        status: "submitted",
        source: "admin_assignment",
      })) as never,
    )
    .select("id, candidate_profile_id");
  if (appErr) throw appErr;

  // Two tables, no transaction available over the Data API: if the match insert
  // fails we roll the applications back so an assignment is never half-written.
  const { error: matchErr } = await admin.from("candidate_matches").insert(
    (apps ?? []).map((a: any) => ({
      application_id: a.id,
      candidate_profile_id: a.candidate_profile_id,
      position_id: positionId,
      organization_id: position.organization_id,
      stage: "screening",
      admin_status: "pending",
      client_visibility: "hidden",
    })) as never,
  );
  if (matchErr) {
    const appIds = (apps ?? []).map((a: any) => a.id as string);
    if (appIds.length > 0) {
      await admin.from("applications").delete().in("id", appIds);
    }
    throw matchErr;
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "bulk.assign_to_position",
    entity_type: "position",
    entity_id: positionId,
    metadata: { candidate_profile_ids: ids, skipped: plan.skipped },
  } as never);

  return { changed: ids.length, skipped: plan.skipped };
}

export async function applyBulkUpdateMessage(
  admin: Admin,
  matchIds: string[],
  message: string,
  actorUserId: string,
) {
  const rows = await loadMatches(admin, matchIds);
  const { emitEventFromServer } = await import("./notifications.functions");
  // Emit in parallel: a 100-row bulk update used to await one event at a time.
  const stamp = Date.now();
  const results = await Promise.all(
    rows.map((row) =>
      emitEventFromServer({
        event: "message_sent",
        scope: `bulk:${row.id}:${stamp}`,
        organization_id: row.organization_id as string,
        position_id: row.position_id as string,
        candidate_match_id: row.id as string,
        candidate_profile_id: row.candidate_profile_id as string,
        actor_user_id: actorUserId,
        payload: { message },
        link_path: `/admin/review/${row.id}`,
      })
        .then(() => true)
        .catch(() => false),
    ),
  );
  const sent = results.filter(Boolean).length;
  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "bulk.send_update",
    entity_type: "candidate_match",
    entity_id: rows[0]?.id ?? null,
    metadata: { match_ids: matchIds, recipients: sent },
  } as never);
  return { changed: sent, skipped: matchIds.length - sent };
}
