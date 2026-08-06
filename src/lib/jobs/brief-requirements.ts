/**
 * Requirements as a record: must-have or trainable, each must-have with a
 * reason and a definition of the evidence that satisfies it.
 *
 * Nothing here deletes a client's requirement and nothing blocks publishing.
 * Weak reasons and unassessable requirements are surfaced to the approver, who
 * decides. Overrides are recorded by the caller.
 */

export type RequirementKind = "must_have" | "trainable";

export type BriefRequirement = {
  id: string;
  /** The client's own wording, preserved verbatim. */
  text: string;
  kind: RequirementKind;
  /** Why this is a must-have. Required for must-haves. */
  reason?: string | null;
  /** What a CV or answer has to show: an artefact, a scale, a system, a named responsibility. */
  evidence?: string | null;
  /** Where it can be evidenced. CV-only requirements feed the rubric. */
  assessed_by?: "cv" | "screening_answer" | "interview" | null;
};

/** More than this many must-haves triggers a review prompt, never a hard cap. */
export const MUST_HAVE_REVIEW_THRESHOLD = 6;

export type RequirementFinding = {
  requirement_id: string;
  code: "missing_reason" | "missing_evidence" | "unassessable" | "years_threshold" | "degree_threshold";
  /** What the reviewer reads. */
  message: string;
  /** Findings never block approval; they appear in the review summary. */
  blocking: false;
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const YEARS = /\b\d{1,2}\+?\s*years?\b/i;
const DEGREE = /\b(bachelor'?s|master'?s|mba|phd|degree)\b/i;
/** Adjectives that cannot be evidenced from a CV or an answer. */
const ADJECTIVE_ONLY =
  /^(a\s+)?(strong|excellent|great|good|proven|passionate|self[- ]starting|self[- ]starter|dynamic|motivated|detail[- ]oriented|team player|hard[- ]working)\b/i;

/** Everything the approver should see about the requirement list. */
export function requirementFindings(reqs: BriefRequirement[]): RequirementFinding[] {
  const out: RequirementFinding[] = [];
  for (const r of reqs) {
    if (r.kind !== "must_have") continue;

    if (!text(r.reason)) {
      out.push({
        requirement_id: r.id,
        code: "missing_reason",
        message: `"${r.text}" is a must-have with no reason. Say why the role fails without it.`,
        blocking: false,
      });
    }
    if (!text(r.evidence)) {
      out.push({
        requirement_id: r.id,
        code: "missing_evidence",
        message: `"${r.text}" has no evidence definition. What would a CV or answer have to show?`,
        blocking: false,
      });
    } else if (ADJECTIVE_ONLY.test(text(r.text)) && !/\b(built|shipped|owned|managed|used|scale|system|tool|£|\$|\d)/i.test(text(r.evidence))) {
      out.push({
        requirement_id: r.id,
        code: "unassessable",
        message: `"${r.text}" reads as an adjective. Name the artefact, scale or system behind it, or move it to trainable.`,
        blocking: false,
      });
    }
    if (YEARS.test(r.text)) {
      out.push({
        requirement_id: r.id,
        code: "years_threshold",
        message: `"${r.text}" sets a years threshold. Justify it against the first-90-day outcomes, not the seniority label.`,
        blocking: false,
      });
    }
    if (DEGREE.test(r.text)) {
      out.push({
        requirement_id: r.id,
        code: "degree_threshold",
        message: `"${r.text}" requires a degree. Keep it only where it is legally or professionally required.`,
        blocking: false,
      });
    }
  }
  return out;
}

/**
 * The review prompt shown when the must-have list is long: it names the ones
 * with the weakest reasons rather than deleting anything.
 */
export function mustHaveReviewPrompt(
  reqs: BriefRequirement[],
): { count: number; weakest: BriefRequirement[]; message: string } | null {
  const musts = reqs.filter((r) => r.kind === "must_have");
  if (musts.length <= MUST_HAVE_REVIEW_THRESHOLD) return null;

  const weakest = [...musts]
    .sort((a, b) => text(a.reason).length - text(b.reason).length)
    .slice(0, musts.length - MUST_HAVE_REVIEW_THRESHOLD);

  return {
    count: musts.length,
    weakest,
    message: `${musts.length} must-haves will shrink the pool sharply. These have the thinnest reasons — consider moving them to trainable: ${weakest
      .map((r) => `"${r.text}"`)
      .join(", ")}.`,
  };
}

/** Candidates see the trainable list as trainable — this is the copy for it. */
export function trainableList(reqs: BriefRequirement[]): string[] {
  return reqs.filter((r) => r.kind === "trainable").map((r) => r.text);
}
