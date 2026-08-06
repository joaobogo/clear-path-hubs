/**
 * Two-step bulk actions.
 *
 * Step 1 (preview): build a plan of exactly which records change, which fields
 * change, and which records are skipped and why. The plan is persisted.
 * Step 2 (execute): the SAME plan id is executed, record by record, so partial
 * failures are reported per record and never as a full success.
 *
 * Rules: no bulk deletes, and no bulk client-visibility change (that path runs
 * through approvals).
 */

import { BULK_STAGES, type BulkStage } from "./admin-bulk-constants";

export type {
  FieldChange,
  PlanRow,
  BulkKind,
  BulkPreview,
  ExecResult,
} from "./bulk-actions.types";
import type {
  PlanRow,
  BulkPreview,
  ExecResult,
  ExecItemResult,
} from "./bulk-actions.types";
import { BULK_EXEC_BATCH, BULK_SELECTION_CAP } from "./bulk-actions.types";

/**
 * Reads are chunked instead of capped. The old `.limit(500)` silently dropped
 * every id past the cap, so an operator could confirm a plan for 500 records
 * without ever learning the rest of their selection existed.
 */
const READ_CHUNK = 100;

function chunk<T>(items: T[], size = READ_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The cap is explicit: past it the request is refused, never truncated. */
function assertWithinCap(ids: string[]) {
  if (ids.length > BULK_SELECTION_CAP) {
    throw new Error(
      `Selection of ${ids.length} records exceeds the bulk limit of ${BULK_SELECTION_CAP}. Narrow the filter and run it in passes.`,
    );
  }
}

/** Loads every requested row in bounded parallel batches, keyed by id. */
async function loadByIds(
  admin: Admin,
  table: string,
  select: string,
  ids: string[],
): Promise<Map<string, Record<string, any>>> {
  assertWithinCap(ids);
  const unique = [...new Set(ids)];
  const results = await Promise.all(
    chunk(unique).map((batch) => admin.from(table).select(select).in("id", batch)),
  );
  const map = new Map<string, Record<string, any>>();
  for (const r of results) {
    if (r.error) throw r.error;
    for (const row of (r.data ?? []) as any[]) map.set(row.id as string, row);
  }
  return map;
}

// Untyped admin client: these queries span many generated table types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const STAGE_LABEL: Record<string, string> = {
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview_process: "Interviewing",
  offer: "Offer",
  not_moving_forward: "Not moving forward",
};

export type BulkParams =
  | { kind: "candidate_stage"; match_ids: string[]; to_stage: BulkStage }
  | { kind: "candidate_assign"; candidate_profile_ids: string[]; position_id: string }
  | { kind: "candidate_update_message"; match_ids: string[]; message: string }
  | { kind: "position_pause"; position_ids: string[] };

async function planCandidateStage(
  admin: Admin,
  matchIds: string[],
  toStage: BulkStage,
): Promise<{ summary: string; rows: PlanRow[] }> {
  const found = await loadByIds(
    admin,
    "candidate_matches",
    "id, stage, admin_status, position_id, candidate_profiles:candidate_profile_id(full_name), positions:position_id(title, status)",
    matchIds,
  );
  const rows: PlanRow[] = matchIds.map((id) => {
    const row = found.get(id);
    if (!row) {
      return { id, label: "Unknown record", context: "—", eligible: false, reason: "Record not found", changes: [] };
    }
    let reason: string | undefined;
    if (row.stage === toStage) reason = "Already at this stage";
    else if (toStage !== "not_moving_forward" && row.admin_status !== "approved")
      reason = "Not approved for release yet";
    else if (row.positions?.status === "closed") reason = "Role is closed";
    return {
      id,
      label: (row.candidate_profiles?.full_name as string) || "Candidate",
      context: (row.positions?.title as string) ?? "—",
      eligible: !reason,
      ...(reason ? { reason } : {}),
      changes: reason
        ? []
        : [
            {
              field: "stage",
              from: STAGE_LABEL[row.stage as string] ?? (row.stage as string),
              to: STAGE_LABEL[toStage] ?? toStage,
            },
          ],
    };
  });
  return { summary: `Move stage to ${STAGE_LABEL[toStage] ?? toStage}`, rows };
}

async function planCandidateAssign(
  admin: Admin,
  candidateProfileIds: string[],
  positionId: string,
): Promise<{ summary: string; rows: PlanRow[] }> {
  assertWithinCap(candidateProfileIds);
  const idChunks = chunk([...new Set(candidateProfileIds)]);
  const [posRes, profiles, existingChunks] = await Promise.all([
    admin
      .from("positions")
      .select("id, title, status, organization_id")
      .eq("id", positionId)
      .maybeSingle(),
    loadByIds(admin, "candidate_profiles", "id, full_name", candidateProfileIds),
    Promise.all(
      idChunks.map((batch) =>
        admin
          .from("candidate_matches")
          .select("candidate_profile_id")
          .eq("position_id", positionId)
          .in("candidate_profile_id", batch),
      ),
    ),
  ]);
  if (posRes.error) throw posRes.error;
  if (!posRes.data) throw new Error("Position not found");
  const position = posRes.data as Record<string, any>;
  for (const r of existingChunks) if (r.error) throw r.error;
  const already = new Set(
    existingChunks
      .flatMap((r) => (r.data ?? []) as any[])
      .map((r: any) => r.candidate_profile_id as string),
  );
  const names = new Map<string, string>(
    [...profiles.entries()].map(([id, p]) => [id, (p.full_name as string) ?? "Candidate"]),
  );

  const rows: PlanRow[] = candidateProfileIds.map((id) => {
    const name = names.get(id);
    const reason = !name
      ? "Record not found"
      : already.has(id)
        ? "Already on this role"
        : position.status === "closed"
          ? "Role is closed"
          : undefined;
    return {
      id,
      label: name ?? "Unknown candidate",
      context: (position.title as string) ?? "—",
      eligible: !reason,
      ...(reason ? { reason } : {}),
      changes: reason
        ? []
        : [
            { field: "application", from: "none", to: "submitted" },
            { field: "stage", from: "none", to: STAGE_LABEL["screening"]! },
            { field: "client_visibility", from: "none", to: "hidden" },
          ],
    };
  });
  return { summary: `Assign to ${(position.title as string) ?? "role"}`, rows };
}

async function planCandidateMessage(
  admin: Admin,
  matchIds: string[],
): Promise<{ summary: string; rows: PlanRow[] }> {
  const found = await loadByIds(
    admin,
    "candidate_matches",
    "id, candidate_profiles:candidate_profile_id(full_name), positions:position_id(title)",
    matchIds,
  );
  const rows: PlanRow[] = matchIds.map((id) => {
    const row = found.get(id);
    if (!row)
      return { id, label: "Unknown record", context: "—", eligible: false, reason: "Record not found", changes: [] };
    return {
      id,
      label: (row.candidate_profiles?.full_name as string) || "Candidate",
      context: (row.positions?.title as string) ?? "—",
      eligible: true,
      changes: [{ field: "client update", from: "none", to: "sent" }],
    };
  });
  return { summary: "Send a client update", rows };
}

async function planPositionPause(
  admin: Admin,
  positionIds: string[],
): Promise<{ summary: string; rows: PlanRow[] }> {
  const found = await loadByIds(
    admin,
    "positions",
    "id, title, status, organizations:organization_id(name)",
    positionIds,
  );
  const rows: PlanRow[] = positionIds.map((id) => {
    const row = found.get(id);
    if (!row)
      return { id, label: "Unknown role", context: "—", eligible: false, reason: "Record not found", changes: [] };
    const reason =
      row.status === "paused"
        ? "Already paused"
        : row.status !== "active"
          ? `Only active roles can be paused (currently ${row.status})`
          : undefined;
    return {
      id,
      label: (row.title as string) ?? "Role",
      context: (row.organizations?.name as string) ?? "—",
      eligible: !reason,
      ...(reason ? { reason } : {}),
      changes: reason ? [] : [{ field: "status", from: "active", to: "paused" }],
    };
  });
  return { summary: "Pause roles", rows };
}

export async function buildPlan(
  admin: Admin,
  params: BulkParams,
): Promise<{ summary: string; rows: PlanRow[] }> {
  switch (params.kind) {
    case "candidate_stage":
      return planCandidateStage(admin, params.match_ids, params.to_stage);
    case "candidate_assign":
      return planCandidateAssign(admin, params.candidate_profile_ids, params.position_id);
    case "candidate_update_message":
      return planCandidateMessage(admin, params.match_ids);
    case "position_pause":
      return planPositionPause(admin, params.position_ids);
  }
}

export async function createPreview(
  admin: Admin,
  actorUserId: string,
  params: BulkParams,
): Promise<BulkPreview> {
  const { summary, rows } = await buildPlan(admin, params);
  const { data, error } = await admin
    .from("bulk_action_plans")
    .insert({ actor_user_id: actorUserId, kind: params.kind, params, rows })
    .select("id")
    .single();
  if (error) throw error;
  return {
    plan_id: data.id as string,
    kind: params.kind,
    summary,
    selected: rows.length,
    eligible: rows.filter((r) => r.eligible).length,
    skipped: rows.filter((r) => !r.eligible).length,
    rows,
  };
}

// ── Per-record execution ─────────────────────────────────────────────────────

async function execStage(
  admin: Admin,
  row: PlanRow,
  toStage: BulkStage,
  actorUserId: string,
) {
  const { error } = await admin
    .from("candidate_matches")
    .update({ stage: toStage, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  await admin.from("candidate_stage_history").insert({
    candidate_match_id: row.id,
    to_stage: toStage,
    changed_by: actorUserId,
    note: "Bulk stage change",
  } as never);
}

async function execAssign(
  admin: Admin,
  row: PlanRow,
  positionId: string,
) {
  const { data: position, error: posErr } = await admin
    .from("positions")
    .select("id, organization_id")
    .eq("id", positionId)
    .single();
  if (posErr) throw new Error(posErr.message);

  const { data: app, error: appErr } = await admin
    .from("applications")
    .insert({
      candidate_profile_id: row.id,
      position_id: positionId,
      status: "submitted",
      source: "admin_assignment",
    } as never)
    .select("id")
    .single();
  if (appErr) throw new Error(appErr.message);

  const { error: matchErr } = await admin.from("candidate_matches").insert({
    application_id: app.id,
    candidate_profile_id: row.id,
    position_id: positionId,
    organization_id: position.organization_id,
    stage: "screening",
    admin_status: "pending",
    client_visibility: "hidden",
  } as never);
  if (matchErr) throw new Error(matchErr.message);
}

async function execMessage(
  admin: Admin,
  row: PlanRow,
  message: string,
  actorUserId: string,
) {
  const { data: match, error } = await admin
    .from("candidate_matches")
    .select("id, organization_id, position_id, candidate_profile_id")
    .eq("id", row.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!match) throw new Error("Record not found");
  const { emitEventFromServer } = await import("./notifications.functions");
  await emitEventFromServer({
    event: "message_sent",
    scope: `bulk:${row.id}:${Date.now()}`,
    organization_id: match.organization_id as string,
    position_id: match.position_id as string,
    candidate_match_id: match.id as string,
    candidate_profile_id: match.candidate_profile_id as string,
    actor_user_id: actorUserId,
    payload: { message },
    link_path: `/admin/review/${match.id}`,
  });
}

async function execPositionPause(admin: Admin, row: PlanRow) {
  // Re-check state at write time: pausing a role that already moved on is a
  // per-record failure, not a silent no-op.
  const { data: pos, error: readErr } = await admin
    .from("positions")
    .select("id, status")
    .eq("id", row.id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!pos) throw new Error("Record not found");
  if (pos.status !== "active") throw new Error(`Role is no longer active (${pos.status})`);
  const { error } = await admin
    .from("positions")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
}

export async function executePlan(
  admin: Admin,
  actorUserId: string,
  planId: string,
  onlyIds?: string[],
): Promise<ExecResult> {
  const { data: plan, error } = await admin
    .from("bulk_action_plans")
    .select("id, actor_user_id, kind, params, rows, expires_at")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plan) throw new Error("This preview is no longer available. Preview the change again.");
  if (plan.actor_user_id !== actorUserId) throw new Error("forbidden");
  if (new Date(plan.expires_at as string).getTime() < Date.now())
    throw new Error("This preview expired. Preview the change again.");

  const params = plan.params as BulkParams;
  const allRows = (plan.rows as PlanRow[]) ?? [];
  const only = onlyIds && onlyIds.length > 0 ? new Set(onlyIds) : null;
  // Only records the operator saw counted as eligible can be written.
  const targets = allRows.filter((r) => r.eligible && (!only || only.has(r.id)));

  const results: ExecResult["results"] = [];
  for (const row of targets) {
    try {
      if (params.kind === "candidate_stage") await execStage(admin, row, params.to_stage, actorUserId);
      else if (params.kind === "candidate_assign") await execAssign(admin, row, params.position_id);
      else if (params.kind === "candidate_update_message")
        await execMessage(admin, row, params.message, actorUserId);
      else if (params.kind === "position_pause") await execPositionPause(admin, row);
      results.push({ id: row.id, label: row.label, ok: true });
    } catch (e) {
      results.push({
        id: row.id,
        label: row.label,
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  await admin
    .from("bulk_action_plans")
    .update({
      executed_at: new Date().toISOString(),
      result: { attempted: results.length, succeeded, failed, results },
    } as never)
    .eq("id", planId);

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: `bulk.${params.kind}`,
    entity_type: params.kind === "position_pause" ? "position" : "candidate_match",
    entity_id: targets[0]?.id ?? null,
    metadata: {
      plan_id: planId,
      attempted: results.length,
      succeeded,
      failed,
      skipped: allRows.filter((r) => !r.eligible).length,
      retry_only: only ? Array.from(only) : null,
    },
  } as never);

  return { plan_id: planId, attempted: results.length, succeeded, failed, results };
}

export { BULK_STAGES };
export type { BulkStage };
