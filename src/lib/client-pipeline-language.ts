// Plain-language pipeline status lines for client-facing surfaces.
//
// One sentence a busy hiring manager understands, e.g.
//   "4 candidates shortlisted, 2 awaiting your review, 1 offer out."
//
// RULES (client language contract):
//  - Never surface internal vocabulary: canonical states, score runs,
//    integrity status, processing states, admin status, fit labels, rubric
//    versions, trace ids.
//  - Only counts the client can act on or verify on screen.
//  - Pure module: no server imports, safe on both sides.

export type PipelineStatusInput = {
  /** Position status (active | approved | draft | paused | closed | archived). */
  status: string;
  /** Delivered candidates still waiting on a first decision from the client. */
  awaitingReview: number;
  /** Candidates the client shortlisted. */
  shortlisted: number;
  /** Candidates at offer. */
  offers: number;
  /** Confirmed hires. */
  hires: number;
  /** Total candidates shared with the client for this role. */
  totalCandidates: number;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function joinClauses(parts: string[]): string {
  return `${parts.join(", ")}.`;
}

/**
 * Build the one-sentence status line for a role. Always returns a sentence —
 * never an empty string, never an internal state name.
 */
export function buildPipelineStatusLine(
  input: PipelineStatusInput,
  now: Date = new Date(),
): string {
  const status = input.status;
  if (status === "draft")
    return "We're reviewing this role. You'll hear from us before the search goes live.";
  if (status === "paused")
    return "This search is on hold. Tell us when you'd like it restarted.";
  if (status === "closed" || status === "archived") {
    return input.hires > 0
      ? `Closed — ${input.hires} ${plural(input.hires, "hire")} confirmed.`
      : "This search is closed.";
  }

  const parts: string[] = [];

  if (input.hires > 0) {
    parts.push(`${input.hires} ${plural(input.hires, "hire")} confirmed`);
  }
  if (input.offers > 0) {
    parts.push(
      `${input.offers} ${plural(input.offers, "offer")} out`,
    );
  }
  if (input.shortlisted > 0) {
    parts.push(`${input.shortlisted} ${plural(input.shortlisted, "candidate")} shortlisted`);
  }
  if (input.awaitingReview > 0) {
    parts.push(`${input.awaitingReview} awaiting your review`);
  }

  if (parts.length > 0) return joinClauses(parts);

  if (input.totalCandidates > 0) {
    return `${input.totalCandidates} ${plural(input.totalCandidates, "candidate")} shared so far — nothing needs you right now.`;
  }
  return "We're building the first shortlist. Nothing needs you yet.";
}

/**
 * Short client-language nudge for "what needs me on this role", or null when
 * nothing is waiting on the client.
 */
export function buildPipelineActionLabel(
  input: Pick<PipelineStatusInput, "status" | "awaitingReview" | "offers">,
): string | null {
  if (["draft", "paused", "closed", "archived"].includes(input.status)) return null;
  if (input.awaitingReview > 0)
    return `${input.awaitingReview} awaiting your review`;
  if (input.offers > 0)
    return `${input.offers} offer${input.offers === 1 ? "" : "s"} awaiting response`;
  return null;
}

/**
 * Where "Review →" must land so the client can actually fix the thing the
 * label names — same precedence as the label, so the two can never disagree.
 *
 * Every target is an exact-id deep link into an existing client surface:
 *  - awaiting review  → candidates list, filtered to this role's new arrivals
 *  - offer outstanding → candidates list at offer stage for this role
 */
export type PipelineActionTarget =
  | {
      kind: "review_candidates";
      to: "/client/candidates";
      search: { position: string; review: "awaiting"; stage: "delivered" };
    }
  | { kind: "offer_response"; to: "/client/offers" };

export function buildPipelineActionTarget(
  input: Pick<PipelineStatusInput, "status" | "awaitingReview" | "offers"> & {
    positionId: string;
  },
): PipelineActionTarget | null {
  if (["draft", "paused", "closed", "archived"].includes(input.status)) return null;
  if (input.awaitingReview > 0)
    return {
      kind: "review_candidates",
      to: "/client/candidates",
      search: { position: input.positionId, review: "awaiting", stage: "delivered" },
    };
  if (input.offers > 0)
    return {
      kind: "offer_response",
      to: "/client/offers",
    };
  return null;
}


