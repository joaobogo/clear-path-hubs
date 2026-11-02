/**
 * Recruiter decisions and screening-claim flags on `eligibility_checks`.
 *
 * Three families of rows share the table, told apart by key prefix:
 *
 *   disq:<question_id>
 *     Written by the engine when a dealbreaker answer disqualifies. Rebuilt on
 *     every run; a stale one is removed.
 *
 *   screening_claim_unverified:<question_id>
 *     Written by the engine, status 'unknown': a dealbreaker answered "yes"
 *     whose linked must-have the CV gives no evidence for. A flag for the
 *     recruiter, never a gate: it does not change eligibility (owner, 2 Nov:
 *     "unsupported screening claims are flagged for the recruiter, not used to
 *     exclude"). Rebuilt on every run like disq:.
 *
 *   recruiter_review:<anything>
 *     A recruiter's decision. The engine reads it and never writes, overwrites
 *     or deletes it, and it always wins:
 *       - 'excepted' with evidence.question_id (or the question id as the key
 *         suffix) lifts that dealbreaker answer's disqualification: no
 *         disqualifying answer, no 'disqualifying_answer' contradiction, no
 *         ineligible cap, eligibility 'excepted'. The answer still counts as
 *         a gap in scoring.
 *       - 'failed' makes the match not_eligible whatever the answers.
 *       - 'passed' records that the recruiter checked the question; it clears
 *         the unverified-claim flag and changes nothing else.
 *
 * Other keys (outreach_contact_suppression, which also uses 'excepted') are
 * not eligibility decisions and are ignored here.
 */
export const DEALBREAKER_KEY_PREFIX = "disq:";
export const UNVERIFIED_CLAIM_KEY_PREFIX = "screening_claim_unverified:";
export const RECRUITER_REVIEW_KEY_PREFIX = "recruiter_review:";

/** Keys the engine owns: rebuilt on every run, stale ones removed. */
export const ENGINE_CHECK_KEY_PREFIXES = [DEALBREAKER_KEY_PREFIX, UNVERIFIED_CLAIM_KEY_PREFIX] as const;

/** A stored eligibility_checks row, as much of it as scoring reads. */
export type StoredEligibilityCheck = {
  qualifier_key: string;
  status: string | null;
  evidence?: unknown;
};

export type RecruiterDecision = {
  qualifier_key: string;
  status: "excepted" | "failed" | "passed";
  /** The screening question the decision is about, when it names one. */
  question_id: string | null;
};

export function isRecruiterReviewKey(key: string | null | undefined): boolean {
  return typeof key === "string" && key.startsWith(RECRUITER_REVIEW_KEY_PREFIX);
}

export function isEngineCheckKey(key: string | null | undefined): boolean {
  return typeof key === "string" && ENGINE_CHECK_KEY_PREFIXES.some((p) => key.startsWith(p));
}

/** evidence.question_id when recorded, else the key's suffix. */
export function recruiterReviewQuestionId(row: StoredEligibilityCheck): string | null {
  const ev = row.evidence;
  if (ev && typeof ev === "object" && !Array.isArray(ev)) {
    const q = (ev as Record<string, unknown>).question_id;
    if (typeof q === "string" && q.trim()) return q.trim();
  }
  const suffix = row.qualifier_key.slice(RECRUITER_REVIEW_KEY_PREFIX.length).trim();
  return suffix || null;
}

/** The recruiter decisions among a match's rows; 'unknown' is not a decision. */
export function recruiterDecisions(
  rows: StoredEligibilityCheck[] | null | undefined,
): RecruiterDecision[] {
  const out: RecruiterDecision[] = [];
  for (const r of rows ?? []) {
    if (!r || !isRecruiterReviewKey(r.qualifier_key)) continue;
    if (r.status !== "excepted" && r.status !== "failed" && r.status !== "passed") continue;
    out.push({ qualifier_key: r.qualifier_key, status: r.status, question_id: recruiterReviewQuestionId(r) });
  }
  return out;
}

/** Questions whose dealbreaker answer a recruiter excepted. */
export function exceptedQuestionIds(rows: StoredEligibilityCheck[] | null | undefined): Set<string> {
  return new Set(
    recruiterDecisions(rows)
      .filter((d) => d.status === "excepted" && d.question_id)
      .map((d) => d.question_id as string),
  );
}

/** Questions a recruiter has decided on in any direction. */
export function reviewedQuestionIds(rows: StoredEligibilityCheck[] | null | undefined): Set<string> {
  return new Set(
    recruiterDecisions(rows)
      .filter((d) => d.question_id)
      .map((d) => d.question_id as string),
  );
}

export type ScoredEligibility = {
  status: "eligible" | "not_eligible" | "excepted";
  /** The check keys that decided it (empty for plain eligible). */
  decided_by: string[];
};

/**
 * Eligibility after a score run. A recruiter's 'failed' wins outright; then
 * any dealbreaker answer the engine still counts as disqualifying; then a
 * recruiter exception. Unverified-claim flags never enter into it.
 */
export function resolveScoredEligibility(input: {
  disqualifying_answers: Array<{ question_id: string }>;
  eligibility_checks: StoredEligibilityCheck[] | null | undefined;
}): ScoredEligibility {
  const decisions = recruiterDecisions(input.eligibility_checks);
  const failed = decisions.filter((d) => d.status === "failed");
  if (failed.length > 0) return { status: "not_eligible", decided_by: failed.map((d) => d.qualifier_key) };
  if (input.disqualifying_answers.length > 0) {
    return {
      status: "not_eligible",
      decided_by: input.disqualifying_answers.map((d) => `${DEALBREAKER_KEY_PREFIX}${d.question_id}`),
    };
  }
  const excepted = decisions.filter((d) => d.status === "excepted");
  if (excepted.length > 0) return { status: "excepted", decided_by: excepted.map((d) => d.qualifier_key) };
  return { status: "eligible", decided_by: [] };
}

/** An eligibility_checks row the engine writes, minus the match columns. */
export type EngineCheckRow = {
  qualifier_key: string;
  qualifier_label: string;
  qualifier_kind: "disqualifier" | "qualifier";
  status: "failed" | "unknown";
  reason: string;
  evidence: Record<string, unknown>;
};

type EngineCheckSource = {
  disqualifying_answers: Array<{ question_id: string; question: string; normalized_value: string }>;
  unverified_screening_claims: Array<{ question_id: string; question: string; requirements: string[] }>;
};

/** The rows a run writes; the live path and the offline rescore share them. */
export function engineCheckRows(result: EngineCheckSource): EngineCheckRow[] {
  const disq: EngineCheckRow[] = result.disqualifying_answers.map((d) => ({
    qualifier_key: `${DEALBREAKER_KEY_PREFIX}${d.question_id}`,
    qualifier_label: d.question,
    qualifier_kind: "disqualifier",
    // eligibility_checks.status accepts passed / failed / unknown / excepted.
    status: "failed",
    reason: `Dealbreaker answer: ${d.normalized_value}`,
    evidence: { question_id: d.question_id, value: d.normalized_value },
  }));
  const unverified: EngineCheckRow[] = (result.unverified_screening_claims ?? []).map((c) => ({
    qualifier_key: `${UNVERIFIED_CLAIM_KEY_PREFIX}${c.question_id}`,
    qualifier_label: `Screening claim unverified: ${c.question}`,
    qualifier_kind: "qualifier",
    status: "unknown",
    reason: `Answered yes, but the CV shows no evidence of: ${c.requirements.join("; ")}. Confirm with the candidate; this does not change eligibility.`,
    evidence: { question_id: c.question_id, answer: "yes", requirements: c.requirements, source: "screening" },
  }));
  return [...disq, ...unverified];
}
