/**
 * Canonical scoring states — mirrors the `canonical_scoring_state` Postgres
 * enum. The database is the source of truth for allowed transitions; this
 * module gives TypeScript callers the same vocabulary and labels.
 *
 * Never expose these labels to candidates or clients; they are internal
 * operational states. Client-safe status text lives in candidate.functions.ts
 * and client.functions.ts.
 */

export const CANONICAL_SCORING_STATES = [
  "ingestion",
  "evidence_extraction",
  "provisional_scoring",
  "human_review",
  "approved",
  "published_to_client",
  "returned_for_correction",
  "superseded",
  "failed",
] as const;

export type CanonicalScoringState = (typeof CANONICAL_SCORING_STATES)[number];

/**
 * Mirror of `tg_candidate_matches_canonical_state`. Keep in sync with the DB
 * trigger. Used by the reviewer UI to preview allowed actions; the DB still
 * has final say.
 */
export const ALLOWED_TRANSITIONS: Record<CanonicalScoringState, CanonicalScoringState[]> = {
  ingestion: ["evidence_extraction", "failed"],
  evidence_extraction: ["provisional_scoring", "failed", "returned_for_correction"],
  provisional_scoring: ["human_review", "failed", "returned_for_correction"],
  human_review: ["approved", "returned_for_correction", "failed"],
  returned_for_correction: [
    "evidence_extraction",
    "provisional_scoring",
    "human_review",
    "failed",
  ],
  approved: ["published_to_client", "returned_for_correction", "superseded"],
  published_to_client: ["superseded", "returned_for_correction"],
  superseded: ["returned_for_correction"],
  failed: ["ingestion", "returned_for_correction"],
};

export const CANONICAL_STATE_LABEL: Record<CanonicalScoringState, string> = {
  ingestion: "Ingestion",
  evidence_extraction: "Evidence extraction",
  provisional_scoring: "Provisional scoring",
  human_review: "Human review",
  approved: "Approved (internal)",
  published_to_client: "Published to client",
  returned_for_correction: "Returned for correction",
  superseded: "Superseded",
  failed: "Failed",
};

export function canTransition(from: CanonicalScoringState, to: CanonicalScoringState): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Shortest legal transition path from `from` to `to`, excluding `from`.
 * The DB trigger only permits single legal hops, so callers must walk each
 * step in order. Returns null when no legal path exists.
 */
export function shortestTransitionPath(
  from: CanonicalScoringState,
  to: CanonicalScoringState,
): CanonicalScoringState[] | null {
  if (from === to) return [];
  const queue: CanonicalScoringState[][] = [[from]];
  const seen = new Set<CanonicalScoringState>([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const next of ALLOWED_TRANSITIONS[last] ?? []) {
      if (seen.has(next)) continue;
      if (next === to) return [...path.slice(1), next];
      seen.add(next);
      queue.push([...path, next]);
    }
  }
  return null;
}
