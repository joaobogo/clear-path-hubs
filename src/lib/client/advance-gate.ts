/**
 * Advancement gate — a candidate may not be advanced towards an interview or
 * an offer while the role brief is still incomplete.
 *
 * The reason is not bureaucratic: an interview run against a brief nobody
 * agreed produces criteria the client never stated and evidence we cannot
 * defend. The same readiness list that blocks approval blocks advancement.
 *
 * Pure module: the server enforces it and the UI reads it to disable the
 * control *before* the click, with the missing fields named and a deep link
 * into the exact wizard step.
 */

import { roleGaps, type ReadinessInput, type RoleGap } from "@/lib/position-readiness";

/** Stages that imply a commitment against agreed criteria. */
export const GATED_STAGES = ["interview_process", "offer", "hired"] as const;
export type GatedStage = (typeof GATED_STAGES)[number];

export function stageNeedsAgreedBrief(stage: string): boolean {
  return (GATED_STAGES as readonly string[]).includes(stage);
}

export type AdvanceGate = {
  blocked: boolean;
  /** Missing brief fields, in the order they should be fixed. */
  missing: RoleGap[];
  /** One sentence a client can act on. */
  message: string | null;
  /** Wizard step that fixes the first gap. */
  step: number | null;
};

export function evaluateAdvanceGate(input: {
  toStage: string;
  position: ReadinessInput | null | undefined;
}): AdvanceGate {
  if (!stageNeedsAgreedBrief(input.toStage) || !input.position) {
    return { blocked: false, missing: [], message: null, step: null };
  }
  const missing = roleGaps(input.position);
  if (missing.length === 0) return { blocked: false, missing: [], message: null, step: null };
  return {
    blocked: true,
    missing,
    step: missing[0]!.step,
    message: gateMessage(missing),
  };
}

export function gateMessage(missing: RoleGap[]): string {
  const names = missing.map((g) => g.label.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `The role brief still needs ${list}. Add it before advancing this candidate, so the interview runs against criteria you agreed.`;
}

/** Error thrown by server functions, and its wire format. */
export const ADVANCE_GATE_ERROR = "role_brief_incomplete";

export function advanceGateError(missing: RoleGap[]): Error {
  return new Error(`${ADVANCE_GATE_ERROR}: ${gateMessage(missing)}`);
}

/** Turn the thrown message back into something a toast can show as-is. */
export function readAdvanceGateError(raw: string): string | null {
  if (!raw.startsWith(ADVANCE_GATE_ERROR)) return null;
  const rest = raw.slice(ADVANCE_GATE_ERROR.length).replace(/^:\s*/, "").trim();
  return rest || "The role brief is incomplete. Add the missing details before advancing.";
}

/** Deep link into the wizard step that fixes the first gap. */
export function briefEditHref(positionId: string, step: number | null): string {
  return step ? `/client/positions/${positionId}/edit?step=${step}` : `/client/positions/${positionId}/edit`;
}
