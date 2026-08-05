/**
 * Sourcing channel quality — data layer.
 *
 * Reads only the attribution views. Per-position detail comes from
 * v_source_attribution (which already excludes test applications) so channel
 * counts reconcile row-for-row with the candidate list shown when a channel is
 * opened. The rollup reads v_source_attribution_rollup and hides test/internal
 * organizations unless explicitly asked for.
 */
import {
  aggregateRollup,
  aggregateSourceQuality,
  type RollupRow,
  type SourceAttributionRow,
  type SourceQuality,
} from "./source-quality";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any };

export type ChannelCandidate = {
  application_id: string;
  match_id: string | null;
  candidate_profile_id: string | null;
  name: string;
  stage: string | null;
  submitted: boolean;
  hired: boolean;
};

export type PositionSourceQuality = SourceQuality & {
  position_id: string;
  candidates_by_channel: Record<string, ChannelCandidate[]>;
};

export async function loadPositionSourceQuality(
  admin: Admin,
  positionId: string,
): Promise<PositionSourceQuality> {
  const res = await admin
    .from("v_source_attribution")
    .select(
      "channel, kind, application_id, candidate_profile_id, match_id, stage, hire_status, hired_at, source_cost_cents",
    )
    .eq("position_id", positionId)
    .limit(2000);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as SourceAttributionRow[];

  const aggregate = aggregateSourceQuality(rows);

  // Resolve display names for the per-channel candidate lists.
  const profileIds = [
    ...new Set(rows.map((r) => r.candidate_profile_id).filter((id): id is string => !!id)),
  ];
  const names = new Map<string, string>();
  if (profileIds.length > 0) {
    const prof = await admin
      .from("candidate_profiles")
      .select("id, full_name")
      .in("id", profileIds)
      .limit(2000);
    if (prof.error) throw new Error(prof.error.message);
    for (const p of (prof.data ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }

  const submittedStages = new Set([
    "delivered",
    "shortlisted",
    "interview_process",
    "offer",
    "hired",
  ]);
  const candidates_by_channel: Record<string, ChannelCandidate[]> = {};
  for (const row of rows) {
    const channel = row.channel?.trim() || "unknown";
    const list = candidates_by_channel[channel] ?? [];
    list.push({
      application_id: row.application_id,
      match_id: row.match_id,
      candidate_profile_id: row.candidate_profile_id,
      name:
        (row.candidate_profile_id ? names.get(row.candidate_profile_id) : undefined) ??
        "Unnamed candidate",
      stage: row.stage,
      submitted: !!row.stage && submittedStages.has(row.stage),
      hired: row.stage === "hired" || row.hire_status === "hired" || !!row.hired_at,
    });
    candidates_by_channel[channel] = list;
  }
  for (const list of Object.values(candidates_by_channel)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { ...aggregate, position_id: positionId, candidates_by_channel };
}

export async function loadSourceQualityRollup(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<SourceQuality> {
  const { loadTestScope } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, opts.includeTest ?? false);

  let q = admin
    .from("v_source_attribution_rollup")
    .select(
      "channel, kind, applications, shortlisted, interviewed, offered, hired, total_cost_cents, organization_id",
    )
    .limit(2000);
  if (scope.orgIds.length > 0) {
    q = q.not("organization_id", "in", `(${scope.orgIds.join(",")})`);
  }
  const res = await q;
  if (res.error) throw new Error(res.error.message);
  return aggregateRollup((res.data ?? []) as RollupRow[]);
}
