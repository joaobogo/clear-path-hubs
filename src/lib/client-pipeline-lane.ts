/**
 * Canonical pipeline lane — ONE derivation of "where is this candidate".
 *
 * Every surface that counts candidates by stage (Overview KPI tiles, the
 * Kanban board columns, the Roles list roll-ups, the role page summary, the
 * Offers page) must place a candidate in exactly one lane, and that placement
 * must be computed here. Before this module the KPI tiles counted an active
 * interview as "interviewing" while the board placed the same person in the
 * Shortlisted column, so the tile said 4 and the column said 2 for identical
 * data.
 *
 * Rule: the stored `stage` decides the lane, except that a candidate still at
 * `delivered`/`shortlisted` who already has a live interview belongs in the
 * interview lane — that is what the client sees happening.
 */
import type { MatchStage } from "@/lib/client-match-stage";

/** Lanes, in board order. Mirrors the stage union exactly — no extra columns. */
export const PIPELINE_LANES = [
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
  "not_moving_forward",
] as const;

export type PipelineLane = (typeof PIPELINE_LANES)[number];

/** Minimum shape any lane consumer must expose. */
export type LaneRow = {
  stage: string;
  /** An interview exists (requested, scheduling, scheduled or completed). */
  interview_active?: boolean | null;
};

function isLane(value: string): value is PipelineLane {
  return (PIPELINE_LANES as readonly string[]).includes(value);
}

/**
 * The lane a candidate belongs to, or `null` when the stored stage is not one
 * the client pipeline knows. Callers surface unknown rows rather than dropping
 * them silently.
 */
export function laneFor(row: LaneRow): PipelineLane | null {
  const stage = String(row.stage);
  if (!isLane(stage)) return null;
  if ((stage === "delivered" || stage === "shortlisted") && row.interview_active) {
    return "interview_process";
  }
  return stage;
}

export function isInLane(row: LaneRow, lane: PipelineLane): boolean {
  return laneFor(row) === lane;
}

/** Rows in one lane. */
export function rowsInLane<T extends LaneRow>(rows: T[], lane: PipelineLane): T[] {
  return rows.filter((r) => laneFor(r) === lane);
}

/** Count per lane plus the rows carrying an unknown stage. */
export function countLanes<T extends LaneRow>(
  rows: T[],
): { counts: Record<PipelineLane, number>; unplaced: T[] } {
  const counts = Object.fromEntries(PIPELINE_LANES.map((l) => [l, 0])) as Record<
    PipelineLane,
    number
  >;
  const unplaced: T[] = [];
  for (const row of rows) {
    const lane = laneFor(row);
    if (!lane) {
      unplaced.push(row);
      continue;
    }
    counts[lane] += 1;
  }
  return { counts, unplaced };
}

/** Group rows into lane buckets, board order preserved by the caller. */
export function groupByLane<T extends LaneRow>(
  rows: T[],
): { byLane: Record<PipelineLane, T[]>; unplaced: T[] } {
  const byLane = Object.fromEntries(PIPELINE_LANES.map((l) => [l, [] as T[]])) as Record<
    PipelineLane,
    T[]
  >;
  const unplaced: T[] = [];
  for (const row of rows) {
    const lane = laneFor(row);
    if (!lane) {
      unplaced.push(row);
      continue;
    }
    byLane[lane].push(row);
  }
  return { byLane, unplaced };
}

/** Lane keys typed as match stages, for transition helpers. */
export function laneKeys(): MatchStage[] {
  return [...PIPELINE_LANES];
}
