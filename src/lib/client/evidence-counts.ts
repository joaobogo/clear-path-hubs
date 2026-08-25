import type { RequirementRow } from "../client-fit-presentation";

export interface EvidenceCounts {
  /** Requirements backed by a direct quote. */
  quoted: number;
  /** Requirements backed by related, non-quoted evidence. */
  related: number;
  /** The single canonical evidenced total: quoted + related. */
  evidenced: number;
  met: number;
  partial: number;
  unknown: number;
  total: number;
  must_met: number;
  must_total: number;
}

/**
 * The single source of truth for candidate evidence counts.
 * Consistently used in:
 * - CandidateHeader chip
 * - WhyThisCandidate "X of Y requirements evidenced"
 * - CandidateComparison grid summary
 * - Role Comparison summary row
 */
export function getEvidenceCounts(rows: RequirementRow[]): EvidenceCounts {
  const met = rows.filter((r) => r.status === "met").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const unknown = rows.filter((r) => r.status === "not_evidenced" || r.status === "missing").length;
  const total = rows.filter((r) => r.status !== "not_applicable").length;

  const mustHaves = rows.filter((r) => r.importance === "must_have");
  const must_met = mustHaves.filter((r) => r.status === "met").length;
  const must_total = mustHaves.length;

  return {
    quoted: met,
    related: partial,
    evidenced: met + partial,
    met,
    partial,
    unknown,
    total,
    must_met,
    must_total,
  };
}
