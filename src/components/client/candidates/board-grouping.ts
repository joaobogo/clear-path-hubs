/**
 * Pure grouping + transition helpers for the candidates board.
 *
 * Extracted so they can be tested without React: the board must never drop a
 * filtered row, never invent a column, and never offer a move the shared
 * STAGE_GRAPH forbids.
 */
import { KANBAN_COLUMNS, STAGE_GRAPH } from "@/components/client/position-detail/constants";
import type { MatchStage } from "@/lib/client-match-stage";

export type StageBuckets<T> = Record<string, T[]>;

/** Rows that carry a stage the board has no column for (never rendered). */
export function groupRowsByStage<T extends { stage: string }>(
  rows: T[],
): { byStage: StageBuckets<T>; unplaced: T[] } {
  const byStage: StageBuckets<T> = {};
  for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
  const unplaced: T[] = [];
  for (const row of rows) {
    const bucket = byStage[row.stage];
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
