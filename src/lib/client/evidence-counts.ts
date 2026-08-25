import type { RequirementRow } from "../client-fit-presentation";
import { resolveRequirementStatus } from "./requirement-status";


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
  // One resolution pass, shared with every other surface: a requirement only
  // counts as evidenced when a real passage backs it.
  const resolved = rows.map((r) => ({ row: r, status: resolveRequirementStatus(r) }));
  const met = resolved.filter((r) => r.status === "met").length;
  const partial = resolved.filter((r) => r.status === "partial").length;
  const unknown = resolved.filter(
    (r) => r.status === "not_evidenced" || r.status === "missing",
  ).length;
  const total = resolved.filter((r) => r.status !== "not_applicable").length;

  const mustHaves = resolved.filter((r) => r.row.importance === "must_have");
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

/**
 * The single canonical requirement-coverage ratio (0..1), identical to the one
 * the candidate profile renders: every declared requirement counts, and partly
 * met requirements count as evidenced. Comparison surfaces MUST use this so
 * they can never contradict the profile.
 */
export function getCoverageRatio(rows: RequirementRow[]): number | null {
  const counts = getEvidenceCounts(rows);
  if (counts.total === 0) return null;
  return counts.evidenced / counts.total;
}

/** Percentage string for a coverage ratio, one decimal only when needed. */
export function formatCoveragePct(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  const v = ratio * 100;
  const rounded = Math.round(v * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
