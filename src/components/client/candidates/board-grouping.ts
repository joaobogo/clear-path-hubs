/**
 * Pure grouping + transition helpers for the candidates board.
 *
 * Extracted so they can be tested without React: the board must never drop a
 * filtered row, never invent a column, and never offer a move the shared
 * STAGE_GRAPH forbids.
 */
import { KANBAN_COLUMNS, STAGE_GRAPH } from "@/components/client/position-detail/constants";
import type { MatchStage } from "@/lib/client-match-stage";
import { laneFor } from "@/lib/client-pipeline-lane";

export type StageBuckets<T> = Record<string, T[]>;

/**
 * Rows that carry a stage the board has no column for (never rendered).
 *
 * Placement uses the canonical lane derivation, not the raw stage, so a column
 * count can never disagree with the KPI tile that counts the same people.
 */
export function groupRowsByStage<T extends { stage: string; interview_active?: boolean | null }>(
  rows: T[],
): { byStage: StageBuckets<T>; unplaced: T[] } {
  const byStage: StageBuckets<T> = {};
  for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
  const unplaced: T[] = [];
  for (const row of rows) {
    const lane = laneFor(row);
    const bucket = lane ? byStage[lane] : undefined;
    if (bucket) bucket.push(row);
    else unplaced.push(row);
  }
  return { byStage, unplaced };
}

/** Column keys, in board order. Single source: KANBAN_COLUMNS. */
export function boardColumnKeys(): MatchStage[] {
  return KANBAN_COLUMNS.map((c) => c.key);
}

/** Targets the shared stage graph allows from `from`, restricted to columns. */
export function allowedTargets(from: MatchStage): MatchStage[] {
  const cols = boardColumnKeys();
  return (STAGE_GRAPH[from] ?? []).filter((to) => cols.includes(to));
}

export function isAllowedTransition(from: MatchStage, to: MatchStage): boolean {
  if (from === to) return false;
  return (STAGE_GRAPH[from] ?? []).includes(to);
}
