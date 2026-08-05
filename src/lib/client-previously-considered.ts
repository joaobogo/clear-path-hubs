/**
 * Previously considered candidates — pure matching and safety rules.
 *
 * Clients pass on strong people for reasons that have nothing to do with the
 * brief: the role got filled, timing was wrong, they were comparing. When a
 * similar role opens, those people should be visible again instead of sourcing
 * restarting from zero.
 *
 * Three hard rules live here:
 *  1. Only candidates the client already saw for an earlier role are eligible.
 *     This module never invents candidates; the caller supplies rows that were
 *     approved as visible for a prior position.
 *  2. A candidate declined for a must-have gap that THIS brief also requires is
 *     never resurfaced.
 *  3. A candidate whose data-retention consent has expired is never resurfaced.
 *
 * There is no re-scoring here. Overlap is a count of shared must-haves, stated
 * as a suggestion in plain text.
 */

/** Decline codes that mean "did not meet a requirement", not "bad timing". */
export const MUST_HAVE_GAP_REASONS: readonly string[] = [
  "missing_critical",
  "experience_depth",
  "evidence_insufficient",
  "eligibility_failed",
  "seniority_mismatch",
  "too_junior",
  "too_senior",
  "language",
  "location_or_work_setup",
  // Unspecified declines cannot be proved harmless, so they stay out.
  "other",
];

/** Decline codes that are about circumstance, safe to revisit. */
export const REVISITABLE_DECLINE_REASONS: readonly string[] = [
  "role_filled_or_paused",
  "availability",
  "compensation",
  "candidate_withdrew",
];

export type RequirementItem = { kind?: string | null; label?: string | null };

export type ConsideredInput = {
  /** Candidate identity, already approved as visible to this client. */
  candidate_profile_id: string;
  candidate_name: string;
  headline: string | null;
  /** The earlier role. */
  prior_position_id: string;
  prior_position_title: string;
  prior_requirements: RequirementItem[];
  /** The earlier decision. */
  decision: "hold" | "not_moving_forward";
  reason_code: string | null;
  reason_label: string | null;
  decided_at: string;
  /** Retention consent expiry. Null means no expiry recorded. */
  consent_expires_at: string | null;
};

export type ConsideredRow = ConsideredInput & {
  /** Must-have labels this brief shares with the earlier role. */
  overlap: string[];
  overlap_count: number;
  /** Plain words: what happened, when, and why it is being suggested. */
  decision_label: string;
  when_label: string;
  suggested_because: string;
};

const DAY = 86_400_000;

function normalise(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function mustHaves(reqs: RequirementItem[] | null | undefined): string[] {
  return (reqs ?? [])
    .filter((r) => (r?.kind ?? "") === "must_have")
    .map((r) => (r?.label ?? "").trim())
    .filter(Boolean);
}

/** Shared must-haves, compared on normalised labels, original casing kept. */
export function mustHaveOverlap(
  briefReqs: RequirementItem[] | null | undefined,
  priorReqs: RequirementItem[] | null | undefined,
): string[] {
  const brief = mustHaves(briefReqs);
  const briefKeys = new Set(brief.map(normalise));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of mustHaves(priorReqs)) {
    const key = normalise(label);
    if (briefKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

/**
 * Whether the earlier decision blocks resurfacing against this brief.
 *
 * A hold is always revisitable. A decline is only revisitable when its reason
 * is about circumstance. When the reason is a must-have gap, the candidate is
 * blocked whenever this brief also states must-haves — the requirement that
 * failed is still in play.
 */
export function isBlockedByEarlierDecision(
  row: Pick<ConsideredInput, "decision" | "reason_code">,
  briefReqs: RequirementItem[] | null | undefined,
): boolean {
  if (row.decision === "hold") return false;
  const code = row.reason_code ?? "other";
  if (REVISITABLE_DECLINE_REASONS.includes(code)) return false;
  if (!MUST_HAVE_GAP_REASONS.includes(code)) return false;
  // The brief still requires must-haves, so the gap still matters.
  return mustHaves(briefReqs).length > 0;
}

/** Consent has to be live now; a missing expiry means none was recorded. */
export function consentExpired(
  consentExpiresAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!consentExpiresAt) return false;
  const t = new Date(consentExpiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

export function whenLabel(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Earlier";
  const days = Math.max(0, Math.floor((now.getTime() - t) / DAY));
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export const DECISION_LABEL: Record<ConsideredInput["decision"], string> = {
  hold: "You put them on hold",
  not_moving_forward: "You passed on them",
};

/**
 * Filters, annotates and orders the earlier candidates for one brief.
 * Rows with no shared must-have are dropped: the section is a suggestion based
 * on overlap, so with nothing in common there is nothing to suggest.
 */
export function buildPreviouslyConsidered(
  briefReqs: RequirementItem[] | null | undefined,
  rows: ConsideredInput[],
  now: Date = new Date(),
): ConsideredRow[] {
  const byCandidate = new Map<string, ConsideredRow>();
  for (const row of rows) {
    if (consentExpired(row.consent_expires_at, now)) continue;
    if (isBlockedByEarlierDecision(row, briefReqs)) continue;
    const overlap = mustHaveOverlap(briefReqs, row.prior_requirements);
    if (overlap.length === 0) continue;
    const built: ConsideredRow = {
      ...row,
      overlap,
      overlap_count: overlap.length,
      decision_label: DECISION_LABEL[row.decision],
      when_label: whenLabel(row.decided_at, now),
      suggested_because: `Suggested because this brief shares ${overlap.length} must-have${
        overlap.length === 1 ? "" : "s"
      } with ${row.prior_position_title}`,
    };
    // One row per candidate: keep the most recent decision.
    const existing = byCandidate.get(row.candidate_profile_id);
    if (!existing || new Date(row.decided_at) > new Date(existing.decided_at)) {
      byCandidate.set(row.candidate_profile_id, built);
    }
  }
  return [...byCandidate.values()].sort((a, b) => {
    if (a.overlap_count !== b.overlap_count) return b.overlap_count - a.overlap_count;
    return new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime();
  });
}
