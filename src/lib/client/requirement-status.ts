import type { RequirementRow, RequirementStatus } from "../client-fit-presentation";

/**
 * One canonical status per requirement, derived from whether evidence exists.
 * Every surface (profile coverage panel, score breakdown, comparison grid)
 * reads this so the same requirement can never show two different states.
 *
 * Invariant: a requirement that carries a quote is never "not evidenced".
 */
/** True when the requirement carries a quoted passage from the candidate's record. */
export function hasEvidenceSource(
  row: Pick<RequirementRow, "evidence"> & { context?: RequirementRow["context"] },
): boolean {
  return (
    (row.evidence ?? []).some((e) => (e.snippet ?? "").trim().length > 0) ||
    (row.context ?? []).some((e) => (e.snippet ?? "").trim().length > 0)
  );
}

export function resolveRequirementStatus(
  row: Pick<RequirementRow, "status" | "evidence" | "contradictions"> & {
    context?: RequirementRow["context"];
  },
): RequirementStatus {
  const hasQuote = hasEvidenceSource(row);

  if (row.status === "contradicted") return "contradicted";
  if (row.status === "not_applicable") return "not_applicable";
  // A verdict without a source is not evidence. Every surface counts a
  // requirement as evidenced only when a passage backs it, so the coverage
  // panel, the header chip and the score breakdown can never disagree.
  if (!hasQuote) return "not_evidenced";
  if (row.status === "met") return "met";
  if (row.status === "partial") return "partial";
  // No verdict from the run, but the candidate's record does back the
  // requirement: that is partly met, never unknown.
  return "partial";
}


/** The single wording used for a requirement status anywhere in the workspace. */
export const REQUIREMENT_STATUS_LABEL: Record<RequirementStatus, string> = {
  met: "Met",
  partial: "Partially met",
  not_evidenced: "Not evidenced",
  missing: "Not evidenced",
  contradicted: "Contradicted",
  not_applicable: "Not applicable",
};

export function requirementStatusLabel(status: RequirementStatus): string {
  return REQUIREMENT_STATUS_LABEL[status] ?? "Not evidenced";
}
