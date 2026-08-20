/**
 * Confirmed hires — the single source of truth.
 *
 * The offer record's own outcome decides whether someone is a confirmed hire.
 * Nothing else (pipeline stage, KPI rollups, view aggregates) may override it,
 * so the KPI tile, the board column and the by-owner footer always agree.
 */
import { qualifiesAsHire } from "@/lib/offer-hire";

export function isConfirmedHire(status: string | null | undefined): boolean {
  return qualifiesAsHire(String(status ?? ""));
}

export function selectConfirmedHires<T extends { status: string }>(
  rows: readonly T[],
): T[] {
  return rows.filter((r) => isConfirmedHire(r.status));
}

export function countConfirmedHires(
  rows: readonly { status: string }[] | null | undefined,
): number {
  return selectConfirmedHires(rows ?? []).length;
}
