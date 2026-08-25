import type { RequirementRow, RequirementStatus } from "../client-fit-presentation";

/**
 * One canonical status per requirement, derived from whether evidence exists.
 * Every surface (profile coverage panel, score breakdown, comparison grid)
 * reads this so the same requirement can never show two different states.
 *
 * Invariant: a requirement that carries a quote is never "not evidenced".
 */
function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * A snippet that only restates the requirement is not evidence — it is the
 * requirement said twice. Shared with the rationale builder so the profile,
 * the counters and the shortlist sentence all discount the same quotes.
 */
export function isEvidenceEcho(requirement: string, snippet: string): boolean {
  const req = normalizeText(requirement ?? "");
  const snip = normalizeText(snippet ?? "");
  return !req || !snip || req === snip;
}

/** True when the requirement carries a quoted passage from the candidate's record. */
export function hasQuotedEvidence(
  row: Pick<RequirementRow, "evidence"> & { label?: string | null },
): boolean {
  return (row.evidence ?? []).some((e) => {
    const snippet = (e.snippet ?? "").trim();
    if (!snippet) return false;
    return !isEvidenceEcho(row.label ?? "", snippet);
  });
}

/**
 * True when nothing is quoted for the requirement, but the run attached a
 * weaker, related passage. These are shown as possible signals, never counted
 * as evidence.
 */
export function hasRelatedSignal(
  row: Pick<RequirementRow, "evidence"> & { context?: RequirementRow["context"] },
): boolean {
  if (hasQuotedEvidence(row)) return false;
  return (row.context ?? []).some((e) => (e.snippet ?? "").trim().length > 0);
}

/** True when the requirement carries any source at all, quoted or related. */
export function hasEvidenceSource(
  row: Pick<RequirementRow, "evidence"> & { context?: RequirementRow["context"] },
): boolean {
  return hasQuotedEvidence(row) || hasRelatedSignal(row);
}

export function resolveRequirementStatus(
  row: Pick<RequirementRow, "status" | "evidence" | "contradictions"> & {
    context?: RequirementRow["context"];
  },
): RequirementStatus {
  if (row.status === "contradicted") return "contradicted";
  if (row.status === "not_applicable") return "not_applicable";
  // A verdict without a quoted passage is not evidence. Related-only matches
  // stay "not evidenced" here and are reported separately as possible signals,
  // so no surface can count a requirement with no source as evidenced.
  if (!hasQuotedEvidence(row)) return "not_evidenced";
  if (row.status === "met") return "met";
  if (row.status === "partial") return "partial";
  // No verdict from the run, but a quote does back the requirement: that is
  // partly met, never unknown.
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
