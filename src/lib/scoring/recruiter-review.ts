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
 *     A recruiter's decision, written only by staff (the admin eligibility
 *     control, setEligibilityDecision). Every eligibility writer reads it —
 *     the engine, the offline rescore, the recompute tool and the database's
 *     recompute_screening_eligibility — and none of them writes, overwrites or
 *     deletes it. It always wins:
 *       - 'excepted' with evidence.question_id (or the question id as the key
 *         suffix) lifts that dealbreaker answer's disqualification: no
 *         disqualifying answer, no 'disqualifying_answer' contradiction, no
 *         ineligible cap, eligibility 'excepted'. The answer still counts as
 *         a gap in scoring.
 *       - 'passed' means the recruiter accepts the answer as
 *         non-disqualifying: on that question it has the same effect as
 *         'excepted' (and clears the unverified-claim flag); the match reads
 *         'eligible' rather than 'excepted' when nothing else applies.
 *       - 'failed' makes the match not_eligible whatever the answers.
 *       - 'unknown' is no decision (a withdrawn one): it is ignored.
 *
 * The unverified-claim flag and the recruiter wording are internal: they live
 * on these rows (label and reason) and in the run's staff-only result fields,
 * never in the run's `concerns`, which reach the client workspace.
 *
 * Other keys (outreach_contact_suppression, which also uses 'excepted') are
 * not eligibility decisions and are ignored here.
 */
export const DEALBREAKER_KEY_PREFIX = "disq:";
export const UNVERIFIED_CLAIM_KEY_PREFIX = "screening_claim_unverified:";
export const RECRUITER_REVIEW_KEY_PREFIX = "recruiter_review:";

/** Recruiter-only wording; never part of a run's client-visible concerns. */
export const UNVERIFIED_CLAIM_LABEL = "Screening claim unverified: ";
export const RECRUITER_EXCEPTION_LABEL = "recruiter exception recorded: ";

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
export function recruiterReviewQuestionId(row: Pick<StoredEligibilityCheck, "qualifier_key" | "evidence">): string | null {
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

/**
 * Questions whose dealbreaker answer no longer disqualifies because a
 * recruiter decided so: 'excepted' (an exception) or 'passed' (the answer is
 * accepted as meeting the bar). Same effect on the question either way.
 */
export function liftedQuestionIds(rows: StoredEligibilityCheck[] | null | undefined): Set<string> {
  return new Set(
    recruiterDecisions(rows)
      .filter((d) => (d.status === "excepted" || d.status === "passed") && d.question_id)
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
  /** The check keys that decided it (empty for plain eligible with no recruiter decision). */
  decided_by: string[];
};

/**
 * Eligibility after a score run. A recruiter's 'failed' wins outright; then
 * any dealbreaker answer the engine still counts as disqualifying (a lifted
 * one — 'excepted' or 'passed' — is not in that list); then a recruiter
 * exception reads 'excepted'. A 'passed' alone reads 'eligible'.
 * Unverified-claim flags never enter into it.
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
  const passed = decisions.filter((d) => d.status === "passed");
  return { status: "eligible", decided_by: passed.map((d) => d.qualifier_key) };
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
    qualifier_label: `${UNVERIFIED_CLAIM_LABEL}${c.question}`,
    qualifier_kind: "qualifier",
    status: "unknown",
    reason: `Answered yes, but the CV shows no evidence of: ${c.requirements.join("; ")}. Confirm with the candidate; this does not change eligibility.`,
    evidence: { question_id: c.question_id, answer: "yes", requirements: c.requirements, source: "screening" },
  }));
  return [...disq, ...unverified];
}

// ─── Recruiter-only wording ──────────────────────────────────────────────────

/**
 * True for a line that is recruiter wording (an unverified screening claim or
 * a recorded recruiter exception). Such a line is internal: a surface the
 * client or candidate sees drops it. The engine no longer writes them into a
 * run's `concerns`; this guards any surface that reads older text.
 */
export function isRecruiterOnlyConcern(line: string | null | undefined): boolean {
  if (typeof line !== "string") return false;
  const t = line.trim().toLowerCase();
  return (
    t.startsWith(UNVERIFIED_CLAIM_LABEL.trim().toLowerCase()) ||
    t.includes(RECRUITER_EXCEPTION_LABEL.trim().toLowerCase())
  );
}

/**
 * The recruiter-only notes a run carries, for staff surfaces: the unverified
 * screening claims and the dealbreaker answers a recruiter lifted. Read from
 * the run's stored result (staff-only by RLS), never from `concerns`.
 */
export function recruiterReviewNotes(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const r = result as {
    recruiter_exceptions?: Array<{ question?: unknown; question_id?: unknown; normalized_value?: unknown }>;
    unverified_screening_claims?: Array<{ question?: unknown; question_id?: unknown; requirements?: unknown }>;
  };
  const q = (x: { question?: unknown; question_id?: unknown }) =>
    (typeof x.question === "string" && x.question.trim()) || `question ${String(x.question_id ?? "")}`;
  const out: string[] = [];
  for (const x of Array.isArray(r.recruiter_exceptions) ? r.recruiter_exceptions : []) {
    if (!x || typeof x !== "object") continue;
    const v = typeof x.normalized_value === "string" ? x.normalized_value : "no";
    out.push(`Dealbreaker answered ${v === "no" ? "no" : `"${v}"`}; ${RECRUITER_EXCEPTION_LABEL}${q(x)}`);
  }
  for (const c of Array.isArray(r.unverified_screening_claims) ? r.unverified_screening_claims : []) {
    if (!c || typeof c !== "object") continue;
    const reqs = Array.isArray(c.requirements) ? c.requirements.filter((t): t is string => typeof t === "string") : [];
    out.push(`${UNVERIFIED_CLAIM_LABEL}${q(c)}${reqs.length ? ` (the CV shows no evidence of: ${reqs.join("; ")})` : ""}`);
  }
  return out;
}

// ─── The admin eligibility control ───────────────────────────────────────────

/** The vocabulary a recruiter decides in: the table's own statuses. */
export const RECRUITER_DECISION_STATUSES = ["passed", "excepted", "failed", "unknown"] as const;
export type RecruiterDecisionStatus = (typeof RECRUITER_DECISION_STATUSES)[number];

export type DecidableCheck = {
  id: string;
  qualifier_key: string;
  qualifier_label?: string | null;
  qualifier_kind?: string | null;
  status?: string | null;
  evidence?: unknown;
};

export type RecruiterDecisionWrite =
  | {
      kind: "update";
      /** The row updated in place: a recruiter_review row or a staff qualifier. */
      id: string;
      qualifier_key: string;
      patch: { status: RecruiterDecisionStatus; reason: string; actor_user_id: string | null };
    }
  | {
      kind: "insert";
      row: {
        qualifier_key: string;
        qualifier_label: string;
        qualifier_kind: "disqualifier";
        status: RecruiterDecisionStatus;
        reason: string;
        actor_user_id: string | null;
        evidence: Record<string, unknown>;
      };
    };

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** The screening question an engine row (disq:/screening_claim_unverified:) is about. */
export function engineCheckQuestionId(check: { qualifier_key: string; evidence?: unknown }): string | null {
  const q = asObject(check.evidence)?.question_id;
  if (typeof q === "string" && q.trim()) return q.trim();
  const prefix = ENGINE_CHECK_KEY_PREFIXES.find((p) => check.qualifier_key.startsWith(p));
  const suffix = prefix ? check.qualifier_key.slice(prefix.length).trim() : "";
  return suffix || null;
}

/**
 * What the admin eligibility control writes. A decision on one of the
 * engine's rows (disq:, screening_claim_unverified:) is recorded as a
 * recruiter_review row for that question — the existing one for the question
 * when there is one, else recruiter_review:<question_id> — and the engine's
 * row is left for the engine: editing it in place was reverted by the next
 * rescore's upsert. A recruiter_review row, or any other staff qualifier, is
 * updated in place.
 */
export function planRecruiterDecision(input: {
  check: DecidableCheck;
  status: RecruiterDecisionStatus;
  reason: string;
  actor_user_id: string | null;
  /** Every eligibility_checks row of the match (to find an existing decision). */
  match_checks: DecidableCheck[];
}): RecruiterDecisionWrite {
  const patch = { status: input.status, reason: input.reason, actor_user_id: input.actor_user_id };
  const { check } = input;
  if (!isEngineCheckKey(check.qualifier_key)) {
    return { kind: "update", id: check.id, qualifier_key: check.qualifier_key, patch };
  }
  const questionId = engineCheckQuestionId(check);
  if (!questionId) throw new Error("check_has_no_question");
  const existing = input.match_checks.find(
    (r) => isRecruiterReviewKey(r.qualifier_key) && recruiterReviewQuestionId(r) === questionId,
  );
  if (existing) return { kind: "update", id: existing.id, qualifier_key: existing.qualifier_key, patch };

  const ev = asObject(check.evidence) ?? {};
  const unverified = check.qualifier_key.startsWith(UNVERIFIED_CLAIM_KEY_PREFIX);
  const answer = unverified ? "yes" : (ev.value ?? ev.answer ?? null);
  const rawLabel = String(check.qualifier_label ?? "");
  const label = (rawLabel.startsWith(UNVERIFIED_CLAIM_LABEL) ? rawLabel.slice(UNVERIFIED_CLAIM_LABEL.length) : rawLabel).trim();
  return {
    kind: "insert",
    row: {
      qualifier_key: `${RECRUITER_REVIEW_KEY_PREFIX}${questionId}`,
      qualifier_label: label || `Screening question ${questionId}`,
      qualifier_kind: "disqualifier",
      status: input.status,
      reason: input.reason,
      actor_user_id: input.actor_user_id,
      evidence: {
        decided_by: "recruiter",
        question_id: questionId,
        source_check: check.qualifier_key,
        ...(answer === null || answer === undefined ? {} : { screening_answer: answer }),
      },
    },
  };
}
