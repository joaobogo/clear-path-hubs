/**
 * Single source of truth for the candidate profile "What needs validation" list.
 *
 * The engine's free-text `concerns` array is written at score time and can drift
 * from the requirement coverage statuses shown on the same page (e.g. saying
 * "Partly evidenced — worth confirming: X" while coverage marks X as Met). To
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
  "partly evidenced — worth confirming:",
  "partly evidenced - worth confirming:",
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
  // The run has finished by the time a client sees this, so say what is true:
  // nothing in the candidate's records supports the requirement.
  not_evidenced: "no supporting evidence found; ask about it in the interview.",
  missing: "no supporting evidence found; ask about it in the interview.",
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

/**
 * Rewrites an engine concern sentence in plain client-facing language.
 * Internal phrasings such as "Only partial evidence for required: X" or
 * "Verify missing or partial evidence." never reach the UI.
 */
export function humanizeConcernSentence(concern: string): string {
  const raw = (concern ?? "").trim();
  if (!raw) return raw;

  const withoutPrefix = (prefix: string) => raw.slice(prefix.length).trim().replace(/^[:\-–—]\s*/, "");
  const lower = raw.toLowerCase();

  const partialPrefixes = [
    "only partial evidence for required:",
    "partly evidenced — worth confirming:",
    "partly evidenced - worth confirming:",
  ];
  for (const p of partialPrefixes) {
    if (lower.startsWith(p)) {
      const label = withoutPrefix(p);
      return label
        ? `We found partial evidence for "${label}" — worth confirming.`
        : "We found partial evidence for this — worth confirming.";
    }
  }

  const missingPrefixes = [
    "no evidence of required:",
    "insufficient evidence — validate:",
    "insufficient evidence - validate:",
  ];
  for (const p of missingPrefixes) {
    if (lower.startsWith(p)) {
      const label = withoutPrefix(p);
      return label
        ? `We found no direct evidence for "${label}".`
        : "We found no direct evidence for this.";
    }
  }

  const conflictPrefix = "contradicting evidence for required:";
  if (lower.startsWith(conflictPrefix)) {
    const label = withoutPrefix(conflictPrefix);
    return label
      ? `The evidence for "${label}" conflicts — worth clarifying.`
      : "The evidence here conflicts — worth clarifying.";
  }

  if (lower === "verify missing or partial evidence." || lower === "verify missing or partial evidence") {
    return "We found no direct evidence for this.";
  }
  if (lower === "only partial evidence." || lower === "only partial evidence") {
    return "We found partial evidence for this — worth confirming.";
  }

  return raw;
}
