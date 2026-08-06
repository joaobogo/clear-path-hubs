/**
 * Position bottleneck diagnosis — data layer.
 *
 * Everything is read from candidate_matches and candidate_stage_history for
 * this position, plus the same figures across the org's other closed roles for
 * comparison. Nothing is invented: when the org has fewer than
 * MIN_COMPARABLE_ROLES closed roles the comparison column is simply absent.
 */
import {
  BOTTLENECK_WINDOW_DAYS,
  DIAGNOSABLE_STAGES,
  MIN_COMPARABLE_ROLES,
  diagnoseBottleneck,
  median,
  stageDurations,
  type BottleneckDiagnosis,
  type StageTransition,
} from "./position-bottleneck";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any };

const DAY = 86_400_000;
const CLOSED_POSITION_STATUSES = ["archived", "closed", "filled"] as const;

type HistoryRow = {
  candidate_match_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
  position_id: string;
};

async function fetchHistory(admin: Admin, positionIds: string[]): Promise<HistoryRow[]> {
  if (positionIds.length === 0) return [];
  const res = await admin
    .from("candidate_stage_history")
    .select("candidate_match_id, from_stage, to_stage, created_at, position_id")
    .in("position_id", positionIds)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as HistoryRow[];
}

export type PositionBottleneck = BottleneckDiagnosis & {
  position_id: string;
  window_days: number;
  generated_at: string;
};

export async function loadPositionBottleneck(
  admin: Admin,
  positionId: string,
): Promise<PositionBottleneck> {
  const nowMs = Date.now();
  const windowStart = nowMs - BOTTLENECK_WINDOW_DAYS * DAY;

  // The three reads only need the position id, so they go out together instead
  // of paying three sequential round trips.
  const [posRes, matchRes, history] = await Promise.all([
    admin.from("positions").select("id, organization_id").eq("id", positionId).maybeSingle(),
    admin.from("candidate_matches").select("id, stage, created_at").eq("position_id", positionId),
    fetchHistory(admin, [positionId]),
  ]);
  if (posRes.error) throw new Error(posRes.error.message);
  if (!posRes.data) throw new Error("Position not found");
  const organizationId = posRes.data.organization_id as string | null;

  if (matchRes.error) throw new Error(matchRes.error.message);
  const matches = (matchRes.data ?? []) as Array<{
    id: string;
    stage: string | null;
    created_at: string;
  }>;



  // Every match that ever entered the pipeline, whether or not it has history.
  const enteredTotal = matches.length;

  // Synthesise the initial entry for matches whose first stage predates history.
  const seeded = new Set(history.filter((h) => h.from_stage === null).map((h) => h.candidate_match_id));
  const transitions: StageTransition[] = [
    ...matches
      .filter((m) => !seeded.has(m.id))
      .map((m) => ({
        match_id: m.id,
        from_stage: null,
        to_stage: "new",
        at: m.created_at,
      })),
    ...history.map((h) => ({
      match_id: h.candidate_match_id,
      from_stage: h.from_stage,
      to_stage: h.to_stage,
      at: h.created_at,
    })),
  ];

  const windowTransitions = transitions.filter(
    (t) => new Date(t.at).getTime() >= windowStart,
  );

  // ── Org comparison across other closed roles ──────────────────────────────
  const orgMedians = new Map<string, number | null>();
  let rolesCompared = 0;

  if (organizationId) {
    const closedRes = await admin
      .from("positions")
      .select("id, status")
      .eq("organization_id", organizationId)
      .neq("id", positionId)
      .in("status", CLOSED_POSITION_STATUSES as unknown as string[])
      .limit(100);
    if (closedRes.error) throw new Error(closedRes.error.message);
    const closedIds = ((closedRes.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    rolesCompared = closedIds.length;

    if (closedIds.length >= MIN_COMPARABLE_ROLES) {
      const closedHistory = await fetchHistory(admin, closedIds);
      const closedMatchRes = await admin
        .from("candidate_matches")
        .select("id, stage")
        .in("position_id", closedIds);
      if (closedMatchRes.error) throw new Error(closedMatchRes.error.message);
      const currentByMatch = new Map<string, string | null>(
        ((closedMatchRes.data ?? []) as Array<{ id: string; stage: string | null }>).map((m) => [
          m.id,
          m.stage,
        ]),
      );
      const durations = stageDurations(
        closedHistory.map((h) => ({
          match_id: h.candidate_match_id,
          from_stage: h.from_stage,
          to_stage: h.to_stage,
          at: h.created_at,
        })),
        currentByMatch,
        nowMs,
      );
      for (const stage of DIAGNOSABLE_STAGES) {
        orgMedians.set(stage, median(durations.get(stage) ?? []));
      }
    }
  }

  const diagnosis = diagnoseBottleneck({
    transitions,
    windowTransitions,
    currentStages: matches.map((m) => ({ match_id: m.id, stage: m.stage })),
    enteredTotal,
    orgMedians,
    rolesCompared,
    nowMs,
  });

  return {
    ...diagnosis,
    position_id: positionId,
    window_days: BOTTLENECK_WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  };
}
