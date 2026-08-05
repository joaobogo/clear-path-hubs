/**
 * Stage-aging aggregation for a single position.
 *
 * Days in stage = now − created_at of the most recent candidate_stage_history
 * row for that match whose to_stage equals the match's current stage. When a
 * match has no matching history row we fall back to the match's own timestamps
 * and label the basis so the UI never presents a guess as history.
 */
import {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  daysBetween,
  isStageAging,
  stageThresholdDays,
  type PipelineStage,
} from "./stage-aging";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any };

export type AgingCandidate = {
  match_id: string;
  candidate_name: string;
  stage: PipelineStage;
  days_in_stage: number;
  stage_entered_at: string;
  basis: "stage_history" | "match_created";
  previous_stage: string | null;
  moved_by: string | null;
  aging: boolean;
  threshold_days: number | null;
};

export type AgingStageBucket = {
  stage: PipelineStage;
  count: number;
  aging_count: number;
  threshold_days: number | null;
  oldest: { match_id: string; candidate_name: string; days_in_stage: number } | null;
};

export type PositionStageAging = {
  position_id: string;
  generated_at: string;
  total_in_pipeline: number;
  buckets: AgingStageBucket[];
  candidates: AgingCandidate[];
};

export async function loadPositionStageAging(
  admin: Admin,
  positionId: string,
): Promise<PositionStageAging> {
  const matchRes = await admin
    .from("candidate_matches")
    .select("id, stage, created_at, updated_at, candidate_profile_id, candidate_profiles(full_name)")
    .eq("position_id", positionId);
  if (matchRes.error) throw new Error(matchRes.error.message);

  const matches = (matchRes.data ?? []) as Array<{
    id: string;
    stage: string | null;
    created_at: string;
    updated_at: string | null;
    candidate_profiles: { full_name: string | null } | null;
  }>;

  const active = matches.filter(
    (m) => !TERMINAL_STAGES.includes((m.stage ?? "new") as PipelineStage),
  );
  const ids = active.map((m) => m.id);

  let history: Array<{
    candidate_match_id: string;
    from_stage: string | null;
    to_stage: string;
    created_at: string;
    actor_user_id: string | null;
  }> = [];

  if (ids.length > 0) {
    const hRes = await admin
      .from("candidate_stage_history")
      .select("candidate_match_id, from_stage, to_stage, created_at, actor_user_id")
      .in("candidate_match_id", ids)
      .order("created_at", { ascending: false });
    if (hRes.error) throw new Error(hRes.error.message);
    history = (hRes.data ?? []) as typeof history;
  }

  const actorIds = [
    ...new Set(history.map((h) => h.actor_user_id).filter(Boolean) as string[]),
  ];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const pRes = await admin
      .from("profiles")
      .select("auth_user_id, full_name, email")
      .in("auth_user_id", actorIds);
    if (pRes.error) throw new Error(pRes.error.message);
    for (const p of (pRes.data ?? []) as Array<{
      auth_user_id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      actorName.set(p.auth_user_id, p.full_name ?? p.email ?? "Unknown user");
    }
  }

  // Newest-first history grouped per match.
  const byMatch = new Map<string, typeof history>();
  for (const h of history) {
    const list = byMatch.get(h.candidate_match_id) ?? [];
    list.push(h);
    byMatch.set(h.candidate_match_id, list);
  }

  const now = Date.now();
  const candidates: AgingCandidate[] = active.map((m) => {
    const stage = (m.stage ?? "new") as PipelineStage;
    const entries = byMatch.get(m.id) ?? [];
    const entry = entries.find((h) => h.to_stage === stage) ?? null;
    const enteredAt = entry?.created_at ?? m.created_at;
    const days = daysBetween(enteredAt, now);
    return {
      match_id: m.id,
      candidate_name: m.candidate_profiles?.full_name ?? "Unknown candidate",
      stage,
      days_in_stage: days,
      stage_entered_at: enteredAt,
      basis: entry ? "stage_history" : "match_created",
      previous_stage: entry?.from_stage ?? null,
      moved_by: entry?.actor_user_id ? (actorName.get(entry.actor_user_id) ?? null) : null,
      aging: isStageAging(stage, days),
      threshold_days: stageThresholdDays(stage),
    };
  });

  const buckets: AgingStageBucket[] = PIPELINE_STAGES.filter(
    (s) => !TERMINAL_STAGES.includes(s),
  ).map((stage) => {
    const rows = candidates.filter((c) => c.stage === stage);
    const oldest = rows.reduce<AgingCandidate | null>(
      (acc, r) => (acc == null || r.days_in_stage > acc.days_in_stage ? r : acc),
      null,
    );
    return {
      stage,
      count: rows.length,
      aging_count: rows.filter((r) => r.aging).length,
      threshold_days: stageThresholdDays(stage),
      oldest: oldest
        ? {
            match_id: oldest.match_id,
            candidate_name: oldest.candidate_name,
            days_in_stage: oldest.days_in_stage,
          }
        : null,
    };
  });

  candidates.sort((a, b) => b.days_in_stage - a.days_in_stage);

  return {
    position_id: positionId,
    generated_at: new Date().toISOString(),
    total_in_pipeline: candidates.length,
    buckets,
    candidates,
  };
}

/** Applies a stage move with a required reason note and writes stage history. */
export async function moveCandidateStageWithReason(
  admin: Admin,
  input: { matchId: string; toStage: PipelineStage; reason: string; actorUserId: string },
): Promise<{ ok: true; from_stage: string | null; to_stage: PipelineStage }> {
  const cur = await admin
    .from("candidate_matches")
    .select("id, stage, organization_id, position_id, candidate_profile_id")
    .eq("id", input.matchId)
    .maybeSingle();
  if (cur.error) throw new Error(cur.error.message);
  if (!cur.data) throw new Error("Candidate match not found");
  const row = cur.data as {
    stage: string | null;
    organization_id: string;
    position_id: string;
    candidate_profile_id: string;
  };
  if (row.stage === input.toStage) throw new Error("Candidate is already in that stage");

  const now = new Date().toISOString();
  const upd = await admin
    .from("candidate_matches")
    .update({ stage: input.toStage, updated_at: now })
    .eq("id", input.matchId);
  if (upd.error) throw new Error(upd.error.message);

  const hist = await admin.from("candidate_stage_history").insert({
    candidate_match_id: input.matchId,
    organization_id: row.organization_id,
    position_id: row.position_id,
    candidate_profile_id: row.candidate_profile_id,
    from_stage: row.stage,
    to_stage: input.toStage,
    reason: input.reason,
    actor_user_id: input.actorUserId,
    actor_role: "platform_staff",
  });
  if (hist.error) throw new Error(hist.error.message);

  await admin.from("audit_events").insert({
    entity_type: "candidate_match",
    entity_id: input.matchId,
    organization_id: row.organization_id,
    action: "candidate_match.stage_moved",
    actor_user_id: input.actorUserId,
    before_state: { stage: row.stage },
    after_state: { stage: input.toStage, reason: input.reason },
  });

  return { ok: true as const, from_stage: row.stage, to_stage: input.toStage };
}
