import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { isStrongFitBand } from "@/lib/scoring/score-counts";

export type ClientCandidateKpis = {
  delivered: number;
  top: number;
  shortlisted: number;
  interviewing: number;
  offers: number;
  hires: number;
};

/**
 * Derive the six Hiring Snapshot tile counts directly from the candidate rows.
 *
 * This keeps the tiles in lock-step with the board: when the board optimistically
 * updates a candidate's stage, the same cached rows feed these numbers, so the
 * tiles refresh immediately without waiting for a separate overview refetch.
 */
export function computeCandidateKpis(
  rows: ClientCandidateDTO[],
  /**
   * Confirmed hires for the workspace, from the one hire selector. The stage
   * never decides this number, so the tile agrees with Offers and Account.
   */
  confirmedHires = 0,
): ClientCandidateKpis {
  let delivered = 0;
  let top = 0;
  let shortlisted = 0;
  let interviewing = 0;
  let offers = 0;

  for (const row of rows) {
    delivered += 1;
    // "Strongest candidates" tile: the same predicate used by the KPI drill-through
    // (filter: "top") and the client-facing band presentation.
    if (isStrongFitBand(row.fit.band)) top += 1;
    if (row.stage === "shortlisted") shortlisted += 1;
    if (row.stage === "interview_process") interviewing += 1;
    if (row.stage === "offer") offers += 1;
  }

  return { delivered, top, shortlisted, interviewing, offers, hires: confirmedHires };
}
