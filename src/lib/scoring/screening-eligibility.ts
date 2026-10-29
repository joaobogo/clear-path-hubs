/**
 * The one rule for screening-driven eligibility.
 *
 * Only an answer to a question flagged `dealbreaker = true` that differs from
 * its preferred answer can make a candidate not_eligible. A "no" to any other
 * question is a missing nice-to-have and is scored, never disqualifying.
 * Every not_eligible decision carries a check naming the question.
 */

export type ScreeningEligibilityAnswer = {
  question_id: string;
  question: string;
  dealbreaker: boolean | null | undefined;
  answer_type: string | null | undefined;
  preferred_answer: unknown;
  value: unknown;
};

export type DealbreakerCheck = {
  qualifier_key: string;
  qualifier_label: string;
  qualifier_kind: "disqualifier";
  status: "not_eligible";
  reason: string;
  evidence: { question_id: string; question: string; answer: unknown; expected: unknown; source: "screening" };
};

export type ScreeningEligibility = {
  status: "eligible" | "not_eligible";
  checks: DealbreakerCheck[];
};

function unwrap(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as Record<string, unknown>)) {
    return (v as { value: unknown }).value;
  }
  return v;
}

function toBool(v: unknown): boolean | null {
  const u = unwrap(v);
  if (typeof u === "boolean") return u;
  if (typeof u === "string") {
    const s = u.trim().toLowerCase();
    if (["yes", "true", "y", "sim"].includes(s)) return true;
    if (["no", "false", "n", "não", "nao"].includes(s)) return false;
  }
  return null;
}

export function isDealbreakerHit(a: ScreeningEligibilityAnswer): boolean {
  if (a.dealbreaker !== true) return false;
  const value = unwrap(a.value);
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return false;
  if (a.answer_type === "boolean") {
    const got = toBool(value);
    if (got === null) return false;
    const pref = toBool(a.preferred_answer);
    // A dealbreaker yes/no question with no preferred answer means "yes is required".
    return got !== (pref ?? true);
  }
  const pref = unwrap(a.preferred_answer);
  if (pref == null || pref === "") return false;
  if (Array.isArray(pref)) {
    const vals = Array.isArray(value) ? value : [value];
    return !vals.some((v) => pref.map(String).includes(String(v)));
  }
  return String(value).trim().toLowerCase() !== String(pref).trim().toLowerCase();
}

export function decideScreeningEligibility(answers: ScreeningEligibilityAnswer[]): ScreeningEligibility {
  const checks: DealbreakerCheck[] = answers.filter(isDealbreakerHit).map((a) => ({
    qualifier_key: `disq:${a.question_id}`,
    qualifier_label: a.question || "Screening dealbreaker",
    qualifier_kind: "disqualifier",
    status: "not_eligible",
    reason: `Dealbreaker question answered "${String(unwrap(a.value))}": "${a.question}"`,
    evidence: {
      question_id: a.question_id,
      question: a.question,
      answer: unwrap(a.value),
      expected: unwrap(a.preferred_answer) ?? true,
      source: "screening",
    },
  }));
  return { status: checks.length ? "not_eligible" : "eligible", checks };
}

export type ExistingCheck = { qualifier_key: string; status: string | null };

export type RecomputePlan = {
  next_status: "eligible" | "not_eligible" | null; // null = leave unchanged
  upserts: DealbreakerCheck[];
  stale_keys: string[]; // screening-derived checks no longer supported
  changed: boolean;
};

const SCREENING_KEY = /^(?:disq:|screening_dealbreaker$)/;

/**
 * Idempotent plan for one match. Screening-derived checks are rebuilt from the
 * dealbreaker rule; any other blocking check (staff-recorded qualifiers) keeps
 * the match not_eligible. Excepted / needs_validation states are left alone.
 */
export function planEligibilityRecompute(input: {
  current_status: string | null;
  answers: ScreeningEligibilityAnswer[];
  existing_checks: ExistingCheck[];
}): RecomputePlan {
  const decision = decideScreeningEligibility(input.answers);
  const wanted = new Set(decision.checks.map((c) => c.qualifier_key));
  const stale_keys = input.existing_checks
    .filter((c) => SCREENING_KEY.test(c.qualifier_key) && !wanted.has(c.qualifier_key))
    .map((c) => c.qualifier_key);
  const otherBlocking = input.existing_checks.some(
    (c) => !SCREENING_KEY.test(c.qualifier_key) && c.status === "not_eligible",
  );
  const have = new Set(input.existing_checks.map((c) => c.qualifier_key));
  const upserts = decision.checks.filter((c) => !have.has(c.qualifier_key));
  let next: RecomputePlan["next_status"] =
    decision.status === "not_eligible" || otherBlocking ? "not_eligible" : "eligible";
  if (input.current_status === "excepted" || input.current_status === "needs_validation") {
    next = decision.status === "not_eligible" ? "not_eligible" : null;
  }
  const changed =
    upserts.length > 0 || stale_keys.length > 0 || (next !== null && next !== input.current_status);
  return { next_status: next, upserts, stale_keys, changed };
}
