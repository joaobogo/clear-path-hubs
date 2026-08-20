/**
 * Offer status reconciliation against the candidate's pipeline stage.
 *
 * The pipeline stage on the candidate match is the single source of truth for
 * "is this person hired". Offer records are a workflow layer on top of it and
 * can lag behind (for example an offer closed as lost, then the candidate was
 * later confirmed as hired). When they disagree, the stage wins — so the offers
 * board can never show a hired candidate in "Closed lost".
 */

export type ReconciledOffer = {
  status: string;
  close_reason?: string | null;
  close_reason_notes?: string | null;
  hired_at?: string | null;
  /** True when the offer status was corrected from the candidate's stage. */
  stage_reconciled?: boolean;
};

/** Stages that mean the candidate is hired, per the candidate pipeline. */
export function stageMeansHired(stage: string | null | undefined): boolean {
  return String(stage ?? "").toLowerCase() === "hired";
}

/**
 * Returns the offer row with its status aligned to the candidate stage.
 * Only ever upgrades a non-hire status to a confirmed hire; never the reverse,
 * because an offer can legitimately be open while the stage is earlier.
 */
export function reconcileOfferWithStage<T extends ReconciledOffer>(
  row: T,
  stage: string | null | undefined,
): T {
  if (!stageMeansHired(stage)) return row;
  if (row.status === "hire_confirmed") return row;
  return {
    ...row,
    status: "hire_confirmed",
    // A closed-lost reason is meaningless once the person is hired.
    close_reason: null,
    close_reason_notes: null,
    hired_at: row.hired_at ?? null,
    stage_reconciled: true,
  };
}
