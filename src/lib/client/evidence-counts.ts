import type { RequirementRow } from "../client-fit-presentation";
import { hasRelatedSignal, resolveRequirementStatus } from "./requirement-status";


export interface EvidenceCounts {
  /** Requirements backed by a direct quote — the only ones counted as evidenced. */
  quoted: number;
  /** Requirements with no quote but a weaker related passage: possible signals. */
  related: number;
  /** The single canonical evidenced total: quoted requirements only. */
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
  // counts as evidenced when a quoted passage backs it.
  const resolved = rows.map((r) => ({ row: r, status: resolveRequirementStatus(r) }));
  const met = resolved.filter((r) => r.status === "met").length;
  const partial = resolved.filter((r) => r.status === "partial").length;
  const unknown = resolved.filter(
    (r) => r.status === "not_evidenced" || r.status === "missing",
  ).length;
  const total = resolved.filter((r) => r.status !== "not_applicable").length;
  const related = resolved.filter(
    (r) => r.status !== "not_applicable" && hasRelatedSignal(r.row),
  ).length;

  const mustHaves = resolved.filter((r) => r.row.importance === "must_have");
  const must_met = mustHaves.filter((r) => r.status === "met").length;
  const must_total = mustHaves.length;


  return {
    quoted: met + partial,
    related,
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


/**
 * Two different measurements, two different names — never interchangeable:
 *
 * - "Must-have coverage" is weighted: a fully evidenced must-have scores one
 *   point, a partly evidenced one half. This is the share the score is built
 *   from (see scoring/score-composition).
 * - "Must-haves fully met" counts only must-haves that are fully evidenced.
 *
 * Every surface that shows either number must call the matching helper here so
 * two surfaces can never disagree about the same measurement.
 */
export const MUST_HAVE_MEASURE_LABELS = {
  coverage: "Must-have coverage",
  fully_met: "Must-haves fully met",
} as const;

/** Weighted must-have coverage as a 0..1 ratio; partly met counts as a half. */
export function getMustHaveCoverageRatio(rows: RequirementRow[]): number | null {
  const resolved = rows
    .map((r) => ({ row: r, status: resolveRequirementStatus(r) }))
    .filter((r) => r.row.importance === "must_have" && r.status !== "not_applicable");
  if (resolved.length === 0) return null;
  const points =
    resolved.filter((r) => r.status === "met").length +
    resolved.filter((r) => r.status === "partial").length * 0.5;
  return points / resolved.length;
}

/** Must-haves that are fully evidenced — no partial credit. */
export function getMustHavesFullyMet(rows: RequirementRow[]): { met: number; total: number } {
  const counts = getEvidenceCounts(rows);
  return { met: counts.must_met, total: counts.must_total };
}
