/**
 * Deterministic ranking (Prompt 5).
 *
 * Ranking order, top-first:
 *   1. Eligibility (eligible/excepted > needs_validation > not_evaluated > not_eligible)
 *   2. Approved recommendation (shortlist > review > hold > pending > do_not_recommend)
 *   3. Fit score (numeric, higher wins)
 *   4. Evidence confidence (higher wins)
 *   5. Role-specific tie-breakers (opaque numeric — highest wins)
 *   6. Deterministic final ordering by candidate_match id (ascending)
 *
 * Unpublished candidates (published=false) are dropped entirely from
 * client-visible totals, per Prompt 5 acceptance criteria.
 */

import type {
  EligibilityStatus,
  RecommendationStatus,
} from "./status-taxonomy";

export type Rankable = {
  id: string;
  eligibility: EligibilityStatus;
  recommendation: RecommendationStatus;
  fit_score: number | null;
  evidence_confidence: number | null;
  tie_breakers?: number[]; // e.g. [seniority_score, recency_score]
  published?: boolean;
};

const ELIG_RANK: Record<EligibilityStatus, number> = {
  eligible: 5,
  excepted: 4,
  needs_validation: 3,
  not_evaluated: 2,
  not_eligible: 1,
};

const REC_RANK: Record<RecommendationStatus, number> = {
  shortlist: 5,
  review: 4,
  hold_for_validation: 3,
  pending: 2,
  do_not_recommend: 1,
};

export function compareRankable(a: Rankable, b: Rankable): number {
  const e = ELIG_RANK[b.eligibility] - ELIG_RANK[a.eligibility];
  if (e !== 0) return e;

  const r = REC_RANK[b.recommendation] - REC_RANK[a.recommendation];
  if (r !== 0) return r;

  const af = a.fit_score ?? -1;
  const bf = b.fit_score ?? -1;
  if (bf !== af) return bf - af;

  const ac = a.evidence_confidence ?? -1;
  const bc = b.evidence_confidence ?? -1;
  if (bc !== ac) return bc - ac;

  const tbLen = Math.max(a.tie_breakers?.length ?? 0, b.tie_breakers?.length ?? 0);
  for (let i = 0; i < tbLen; i++) {
    const av = a.tie_breakers?.[i] ?? -1;
    const bv = b.tie_breakers?.[i] ?? -1;
    if (bv !== av) return bv - av;
  }
  // Deterministic final tiebreak — never rely on unstable input ordering.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Sort candidates for a position. Drops unpublished rows when
 * `clientVisibleOnly` is true (client kanban, share links, exports).
 */
export function rankCandidates<T extends Rankable>(
  items: T[],
  opts: { clientVisibleOnly?: boolean } = {},
): T[] {
  const filtered = opts.clientVisibleOnly
    ? items.filter((i) => i.published !== false)
    : [...items];
  filtered.sort(compareRankable);
  return filtered;
}
