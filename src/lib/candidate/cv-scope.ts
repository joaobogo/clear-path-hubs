/**
 * Which of a candidate's applications may have their CV swapped, and why not
 * when they may not. Shared by the server function and the /me/cv UI so the
 * reason shown to the candidate is the reason enforced on the server.
 */
export type CvScopeReason = "eligible" | "offer_stage" | "closed";

export const CV_SCOPE_COPY: Record<Exclude<CvScopeReason, "eligible">, string> = {
  offer_stage:
    "At offer stage — the employer is deciding on the CV they already have, so it stays as submitted.",
  closed: "Closed — it keeps the CV it was submitted with.",
};

const CLOSED_APPLICATION_STATUSES = ["withdrawn", "rejected", "archived"];
const CLOSED_MATCH_STAGES = ["not_moving_forward", "archived"];
const OFFER_MATCH_STAGES = ["offer", "hired"];

export function cvScopeReason(input: {
  application_status: string | null | undefined;
  withdrawn_at: string | null | undefined;
  position_status: string | null | undefined;
  match_stages: readonly (string | null | undefined)[];
}): CvScopeReason {
  const stages = input.match_stages.filter(Boolean) as string[];
  if (stages.some((s) => OFFER_MATCH_STAGES.includes(s))) return "offer_stage";
  if (
    input.withdrawn_at ||
    CLOSED_APPLICATION_STATUSES.includes(String(input.application_status ?? "")) ||
    ["closed", "filled", "cancelled"].includes(String(input.position_status ?? "")) ||
    (stages.length > 0 && stages.every((s) => CLOSED_MATCH_STAGES.includes(s)))
  ) {
    return "closed";
  }
  return "eligible";
}
