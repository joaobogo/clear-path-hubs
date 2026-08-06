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

/**
 * Rows per read. A single `.in()` with hundreds of ids is one long statement that
 * gets slower as the platform grows; chunking keeps each read small and bounded.
 */
const LOAD_CHUNK = 100;

async function loadMatchesChunk(admin: Admin, matchIds: string[]) {
  const { data, error } = await admin
    .from("candidate_matches")
    .select(
      "id, stage, admin_status, client_visibility, position_id, organization_id, candidate_profile_id, candidate_profiles:candidate_profile_id(full_name), positions:position_id(title, status)",
    )
    .in("id", matchIds);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, any>>;
}

/**
 * Loads every requested match, in chunks, with no arbitrary ceiling. The old
 * hardcoded limit(500) silently dropped rows past the cap — an operator would
 * confirm a plan for 500 and never learn the rest existed.
 */
async function loadMatches(admin: Admin, matchIds: string[]) {
  const unique = [...new Set(matchIds)];
  const out: Array<Record<string, any>> = [];
  for (let i = 0; i < unique.length; i += LOAD_CHUNK) {
    out.push(...(await loadMatchesChunk(admin, unique.slice(i, i + LOAD_CHUNK))));
  }
  return out;
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

export type AssignItemResult = {
  candidate_profile_id: string;
  name: string;
  assigned: boolean;
  reason: string | null;
};

export async function applyAssign(
  admin: Admin,
  candidateProfileIds: string[],
  positionId: string,
  actorUserId: string,
): Promise<{ changed: number; skipped: number; results: AssignItemResult[] }> {
  if (candidateProfileIds.length === 0) return { changed: 0, skipped: 0, results: [] };

  // One database routine writes the applications, the matches and the audit row
  // inside a single transaction: a partial failure rolls everything back, so an
  // assignment can never leave orphaned application rows behind. It also returns
  // a per-candidate outcome so the UI can report partial success accurately.
  const { data, error } = await admin.rpc("admin_bulk_assign_candidates" as never, {
    _position_id: positionId,
    _candidate_profile_ids: candidateProfileIds,
    _actor_user_id: actorUserId,
  } as never);
  if (error) throw error;

  const result = (data ?? {}) as {
    changed?: number;
    skipped?: number;
    results?: AssignItemResult[];
  };
  const results = Array.isArray(result.results) ? result.results : [];
  const changed = Number(result.changed ?? results.filter((r) => r.assigned).length);
  return {
    changed,
    skipped: Number(result.skipped ?? Math.max(0, candidateProfileIds.length - changed)),
    results,
  };
}


export async function applyBulkUpdateMessage(
  admin: Admin,
  matchIds: string[],
  message: string,
  actorUserId: string,
) {
  const rows = await loadMatches(admin, matchIds);
  const { emitEventFromServer } = await import("./notifications.functions");
  // Emit in parallel and keep every outcome: a partial failure has to be
  // reportable per recipient, not averaged into a count.
  const stamp = Date.now();
  const settled = await Promise.allSettled(
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
      }),
    ),
  );

  const failures = settled.flatMap((r, i) =>
    r.status === "rejected"
      ? [
          {
            match_id: rows[i]?.id as string,
            candidate_name: displayName(rows[i] ?? {}),
            reason:
              r.reason instanceof Error ? r.reason.message : String(r.reason ?? "Unknown error"),
          },
        ]
      : [],
  );
  const sent = settled.length - failures.length;

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "bulk.send_update",
    entity_type: "candidate_match",
    entity_id: rows[0]?.id ?? null,
    metadata: {
      match_ids: matchIds,
      recipients: sent,
      failed: failures.length,
      failures: failures.slice(0, 25),
    },
  } as never);

  return {
    changed: sent,
    skipped: matchIds.length - rows.length,
    failures,
  };
}
