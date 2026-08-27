import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { isStrongFitBand } from "@/lib/scoring/score-counts";

export type ClientCandidateKpis = {
  delivered: number;
  top: number;
  shortlisted: number;
  interviewing: number;
  offers: number;
  hires: number;
  /**
   * Candidates delivered with no decision recorded yet — the one "awaiting your
   * review" rule, identical to the Overview queue, Roles and Insights. Derived
   * from the rows on screen so the tile can never read the total candidate count.
   */
  awaiting_decision: number;
  /**
   * Stage partition: every shared candidate falls into exactly one bucket, so a
   * row of stage tiles adds up to `delivered` and can never sum to more than the
   * list beneath it. `hires` stays the confirmed-hire figure and is not part of
   * the partition — `stage_partition.hired` is.
   */
  stage_partition: {
    awaiting: number;
    shortlisted: number;
    interviewing: number;
    offer: number;
    hired: number;
    closed: number;
    elsewhere: number;
  };
};

/**
 * Derive the Hiring Snapshot tile counts directly from the candidate rows.
 *
 * This keeps the tiles in lock-step with the board: when the board optimistically
 * updates a candidate's stage, the same cached rows feed these numbers, so the
 * tiles refresh immediately without waiting for a separate overview refetch.
 */
export function computeCandidateKpis(
  rows: ClientCandidateDTO[],
  /**
   * Confirmed hires for the workspace, from the one hire selector. Optional:
   * when it isn't supplied yet (the workspace summary is still loading) the
   * rows' own confirmed-offer flag decides, so the tile can't flip 1 → 0 → 1
   * across reloads while the candidate still reads "Hired".
   */
  confirmedHires?: number,
): ClientCandidateKpis {
  let delivered = 0;
  let top = 0;
  let awaitingDecision = 0;
  let rowHires = 0;
  const part = {
    awaiting: 0,
    shortlisted: 0,
    interviewing: 0,
    offer: 0,
    hired: 0,
    closed: 0,
    elsewhere: 0,
  };

  for (const row of rows) {
    delivered += 1;
    // "Strongest candidates" tile: the same predicate used by the KPI drill-through
    // (filter: "top") and the client-facing band presentation.
    if (isStrongFitBand(row.fit.band)) top += 1;
    // The canonical awaiting rule: delivered and no decision recorded.
    if (row.stage === "delivered" && !row.client_decided) awaitingDecision += 1;
    if (row.hire_confirmed) rowHires += 1;
    switch (row.stage) {
      case "delivered":
        part.awaiting += 1;
        break;
      case "shortlisted":
        part.shortlisted += 1;
        break;
      case "interview_process":
        part.interviewing += 1;
        break;
      case "offer":
        part.offer += 1;
        break;
      case "hired":
        part.hired += 1;
        break;
      case "not_moving_forward":
        part.closed += 1;
        break;
      default:
        part.elsewhere += 1;
    }
  }

  return {
    delivered,
    top,
    shortlisted: part.shortlisted,
    interviewing: part.interviewing,
    offers: part.offer,
    hires: confirmedHires ?? rowHires,
    awaiting_decision: awaitingDecision,
    stage_partition: { ...part, awaiting: awaitingDecision },
  };
}
