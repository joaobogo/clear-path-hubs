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

type OfferShape = {
  status: string;
  close_reason?: string | null;
  close_reason_notes?: string | null;
  declined_at?: string | null;
  closed_at?: string | null;
  hired_at?: string | null;
};

/**
 * Makes one offer record internally coherent before anything displays it.
 *
 * Two rules, and they hold everywhere an offer record is read:
 *  1. A confirmed hire carries no close reason and no decline or close
 *     timestamp, so it can never be labelled closed or declined.
 *  2. A record stamped with a hire date, carrying no close reason and no
 *     decline timestamp, is a confirmed hire whatever its status column says.
 *
 * The stored row is never written to here — only the value handed to the
 * screen is corrected, so the offer label, the pipeline stage and the
 * timeline read the same outcome.
 */
export function normalizeOfferRecord<T extends OfferShape>(row: T): T {
  const closedWithoutEvidence =
    (row.status === "closed_lost" || row.status === "offer_declined") &&
    !row.close_reason &&
    !row.declined_at &&
    Boolean(row.hired_at);

  const status = closedWithoutEvidence ? "hire_confirmed" : row.status;
  if (!isConfirmedHire(status)) return row;

  return {
    ...row,
    status,
    close_reason: null,
    close_reason_notes: null,
    declined_at: null,
    closed_at: null,
  };
}

export function normalizeOfferRecords<T extends OfferShape>(
  rows: readonly T[] | null | undefined,
): T[] {
  return (rows ?? []).map((r) => normalizeOfferRecord(r));
}
