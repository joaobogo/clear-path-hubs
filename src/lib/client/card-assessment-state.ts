/**
 * One exclusive assessment state per candidate card.
 *
 * A card used to be able to say three things at once: a fit label, "being
 * re-checked", and "requirements still being mapped". Those cannot all be true
 * to a reader, so this module collapses them into exactly one state:
 *
 *  - settled     — a fit label with written-up evidence behind it.
 *  - rechecking   — the inputs moved AND we have a recorded reason for it, and
 *                   there is no evidence write-up on screen to contradict.
 *  - pending      — no settled assessment yet; say what will fill it.
 *
 * Language stays as agreed: screening / assessment, never "AI score".
 */

export type CardAssessment =
  | {
      state: "settled";
      /** True when there is a write-up but it is thin — say so, don't hide it. */
      thin: boolean;
      /** Short line under the badge: what the evidence covers. */
      note: string;
    }
  | { state: "rechecking"; note: string }
  | { state: "pending"; note: string };

export type CardAssessmentInput = {
  /** Band label from the engine, when one is approved. */
  fitLabel?: string | null;
  /** Internal score — presence only; never displayed on client surfaces. */
  score?: number | null;
  /** Evidence bullets already written up for this card. */
  evidenceBullets: number;
  /** Requirements evidenced out of those assessed, when the view has them. */
  support?: { supported: number; total: number } | null;
  /** Freshness verdict, including its recorded reasons. */
  freshness?: { state: "current" | "stale" | "unknown"; reasons?: Array<{ label: string }> } | null;
};

/** Fewer than this many written-up bullets reads as a thin write-up. */
export const THIN_EVIDENCE_BELOW = 2;

export function deriveCardAssessment(input: CardAssessmentInput): CardAssessment {
  const hasBand = input.fitLabel != null || input.score != null;
  const bullets = input.evidenceBullets;
  const hasEvidence = bullets > 0;
  const reason = input.freshness?.reasons?.find((r) => r.label?.trim())?.label?.trim() ?? null;
  const rechecking = input.freshness?.state === "stale" && reason != null;

  // A recorded re-check reason only wins when there is no write-up on screen.
  if (rechecking && !hasEvidence) {
    return { state: "rechecking", note: reason! };
  }

  if (hasBand && hasEvidence) {
    const support = input.support;
    const note =
      support && support.total > 0
        ? `${support.supported} of ${support.total} of your requirements evidenced`
        : `${bullets} requirement${bullets === 1 ? "" : "s"} evidenced from the CV`;
    return { state: "settled", thin: bullets < THIN_EVIDENCE_BELOW, note };
  }

  return {
    state: "pending",
    note: hasBand
      ? "Screening is done — the evidence write-up against your requirements is being finished."
      : "Screening in progress. The assessment and its evidence appear here once complete.",
  };
}

/**
 * Evidence lines must read "requirement — the proof", not the requirement
 * twice. Engine interpretations often restate the criterion first, which
 * produced lines like "Strong SQL — Strong SQL: five years…".
 */
export function dropRequirementEcho(requirement: string, claim: string): string {
  const req = requirement.trim();
  const text = claim.trim();
  if (!req || !text) return text;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const reqNorm = norm(req);
  if (!reqNorm) return text;

  // Strip a leading echo of the requirement plus any separator that follows.
  // A text that is nothing but the requirement carries no proof, so return
  // empty and let the caller choose a different source.
  const words = reqNorm.split(" ").length;
  const lead = text.split(/\s+/).slice(0, words).join(" ");
  if (norm(lead) === reqNorm) {
    const rest = text.slice(lead.length).replace(/^\s*[—–\-:;,.…]+\s*/, "").trim();
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
  }
  return text;
}
