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
 * Rule: the stored `stage` decides the lane. A candidate in `delivered` or
 * `shortlisted` who already has a live interview is STILL shown in those
 * stages — the interview is a milestone within the stage, not a lane move.

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
  /**
   * Every interview on this match was called off and none was held.
   *
   * The rule below — the stored stage decides the lane — is right for ENTERING
   * an interview and wrong for leaving one. A cancellation does not move the
   * stage, so the lane kept counting a candidate as interviewing while the row
   * label beside it, computed from interview status, correctly read "Interview
   * cancelled": one person interviewing, the tile said two
   * (audit 1 Sep, F6).
   */
  interview_called_off?: boolean | null;
};

function isLane(value: string): value is PipelineLane {
  return (PIPELINE_LANES as readonly string[]).includes(value);
}

/**
 * Stages a client-visible candidate can hold that deliberately have no lane.
 *
 * loadKpiRows selects every match with client_visibility = "visible"
 * regardless of stage, so these rows DO reach the counting layer. Without this
 * list they fell through laneFor as "unknown" and were dropped from every tile,
 * board column and roll-up in silence — the same tile-versus-column
 * disagreement this module was written to end, arriving through the back door.
 *
 * They are still excluded: a withdrawn or paused candidate is not work in any
 * lane. The difference is that the exclusion is now a decision on the record,
 * and stage-vocabulary-is-real.test.ts fails if a new stage appears that is
 * neither a lane nor listed here.
 */
export const STAGES_WITHOUT_LANE = [
  "new",
  "sourced",
  "screening",
  "in_review",
  "on_hold",
  "withdrawn",
] as const;

function isDeliberatelyExcluded(value: string): boolean {
  return (STAGES_WITHOUT_LANE as readonly string[]).includes(value);
}

/**
 * The lane a candidate belongs to, or `null` when the stored stage is not one
 * the client pipeline knows. Callers surface unknown rows rather than dropping
 * them silently.
 */
export function laneFor(row: LaneRow): PipelineLane | null {
  const stage = String(row.stage);
  if (!isLane(stage)) return null;
  // The one exception to "the stage decides the lane". A candidate whose only
  // interview was cancelled is back where they were before it was arranged —
  // shortlisted — and every surface reads that from here, so the tile, the
  // board column and the row label cannot disagree. A COMPLETED interview is
  // not this case: that candidate is still in the interview stage.
  if (stage === "interview_process" && row.interview_called_off && !row.interview_active) {
    return "shortlisted";
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
): { counts: Record<PipelineLane, number>; unplaced: T[]; excluded: T[] } {
  const counts = Object.fromEntries(PIPELINE_LANES.map((l) => [l, 0])) as Record<
    PipelineLane,
    number
  >;
  const unplaced: T[] = [];
  const excluded: T[] = [];
  for (const row of rows) {
    const lane = laneFor(row);
    if (!lane) {
      // "Not counted on purpose" and "we do not recognise this stage" are
      // different facts. Both were reported as unplaced, and every caller
      // discarded unplaced, so a genuinely unknown stage looked identical to a
      // withdrawal.
      (isDeliberatelyExcluded(String(row.stage)) ? excluded : unplaced).push(row);
      continue;
    }
    counts[lane] += 1;
  }
  return { counts, unplaced, excluded };
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
