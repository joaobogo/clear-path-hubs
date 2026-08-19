/**
 * Single source of truth for the candidate profile "What needs validation" list.
 *
 * The engine's free-text `concerns` array is written at score time and can drift
 * from the requirement coverage statuses shown on the same page (e.g. saying
 * "Only partial evidence for required: X" while coverage marks X as Met). To
 * guarantee the badge and the sentence never contradict each other, every
 * requirement-derived sentence is generated here from the coverage status, and
 * requirement-shaped engine concerns are discarded.
 */

import type { RequirementRow, RequirementStatus } from "@/lib/client-fit-presentation";

export type ValidationItem = {
  id: string;
  /** Requirement label, or null for run-level notes (contradictions, unreadable CV). */
  label: string | null;
  /** Coverage status this sentence agrees with; null for run-level notes. */
  status: RequirementStatus | null;
  sentence: string;
  tone: "warning" | "neutral";
};

/**
 * Prefixes the scoring engine uses when it restates a requirement. Any concern
 * matching one of these is a duplicate of the coverage row and is dropped in
 * favour of the derived sentence.
 */
const REQUIREMENT_CONCERN_PREFIXES = [
  "insufficient evidence — validate:",
  "insufficient evidence - validate:",
  "no evidence of required:",
  "contradicting evidence for required:",
  "only partial evidence for required:",
  "demonstrated:",
];

export function isRequirementShapedConcern(concern: string): boolean {
  const s = concern.trim().toLowerCase();
  return REQUIREMENT_CONCERN_PREFIXES.some((p) => s.startsWith(p));
}

const SENTENCE: Record<RequirementStatus, string> = {
  met: "evidenced; confirm at interview as a formality.",
  partial: "partially evidenced; confirm depth in the interview.",
  contradicted: "the evidence conflicts; ask the candidate to clarify.",
  not_evidenced: "Evidence extraction is still running",
  missing: "Evidence extraction is still running",
  not_applicable: "Not applicable",
};

export type BuildValidationListOptions = {
  /** Include Met requirements as low-priority "confirm at interview" rows. */
  includeMet?: boolean;
  maxRequirements?: number;
  /** Hide notes derived from requirement status (contradicted, not_evidenced). */
  hideRequirementEvidenceNotes?: boolean;
};


export function buildValidationList(
  requirementRows: RequirementRow[],
  concerns: string[] = [],
  options: BuildValidationListOptions = {},
): ValidationItem[] {
  const { includeMet = false, maxRequirements = 6, hideRequirementEvidenceNotes = false } = options;

  const statuses: RequirementStatus[] = includeMet
    ? ["contradicted", "not_evidenced", "partial", "met"]
    : ["contradicted", "not_evidenced", "partial"];

  const requirementItems: ValidationItem[] = hideRequirementEvidenceNotes ? [] : statuses.flatMap((status) =>
    requirementRows
      .filter((r) => r.status === status)
      .map((r) => ({
        id: r.id,
        label: r.label,
        status,
        sentence: SENTENCE[status as Exclude<RequirementStatus, "not_applicable">],
        tone: status === "met" ? ("neutral" as const) : ("warning" as const),
      })),
  );

  const runNotes: ValidationItem[] = concerns
    .filter((c) => c.trim().length > 0 && !isRequirementShapedConcern(c))
    .map((c, i) => ({
      id: `note-${i}`,
      label: null,
      status: null,
      sentence: c.trim(),
      tone: "warning" as const,
    }));

  return [...runNotes, ...requirementItems.slice(0, maxRequirements)];
}
