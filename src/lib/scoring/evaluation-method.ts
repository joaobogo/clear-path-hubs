/**
 * Truthful method labelling — Prompt 11.
 *
 * "hybrid" was a marketing word, not a fact about a run. A run is produced by
 * exactly one of four things and we say which:
 *
 *  - `deterministic`   rule and term matching over the extracted CV text, no model call
 *  - `semantic`        model-assisted evidence evaluation over the same criteria
 *  - `human_adjusted`  a reviewer's verdicts recomputed on top of a machine run
 *  - `legacy`          produced before the current scoring contract; method unknown
 *
 * `legacy` is the honest label for anything we cannot attribute — including the
 * historical `hybrid` and `keyword` strings. We never re-label an old run as
 * something it may not have been.
 */

export const EVALUATION_METHODS = [
  "deterministic",
  "semantic",
  "human_adjusted",
  "legacy",
] as const;

export type EvaluationMethod = (typeof EVALUATION_METHODS)[number];

export const LEGACY_EVALUATION_METHOD: EvaluationMethod = "legacy";

/** Strings written by earlier engines, mapped to what they actually were. */
const ALIASES: Record<string, EvaluationMethod> = {
  deterministic: "deterministic",
  deterministic_keyword: "deterministic",
  keyword: "deterministic",
  rules: "deterministic",
  rule_based: "deterministic",
  semantic: "semantic",
  semantic_evidence: "semantic",
  llm: "semantic",
  embedding: "semantic",
  human_adjusted: "human_adjusted",
  human: "human_adjusted",
  human_verified: "human_adjusted",
  legacy: "legacy",
  // Deliberately NOT mapped to a real engine: "hybrid" never told us which
  // path ran, so the truthful label is legacy.
  hybrid: "legacy",
};

export function normalizeEvaluationMethod(
  raw: string | null | undefined,
): EvaluationMethod {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return LEGACY_EVALUATION_METHOD;
  return ALIASES[key] ?? LEGACY_EVALUATION_METHOD;
}

export function isEvaluationMethod(raw: unknown): raw is EvaluationMethod {
  return EVALUATION_METHODS.includes(raw as EvaluationMethod);
}

/** Short label for staff surfaces. */
export const METHOD_LABELS: Record<EvaluationMethod, string> = {
  deterministic: "Rule-based",
  semantic: "Model-assisted",
  human_adjusted: "Human-adjusted",
  legacy: "Legacy run",
};

/** One sentence naming the method, for the top of any explanation. */
export const METHOD_SENTENCES: Record<EvaluationMethod, string> = {
  deterministic:
    "Matched against your must-haves. A person on our team checks it.",
  semantic:
    "Assessed with model-assisted evidence matching against the role's criteria, then checked against the CV text.",
  human_adjusted:
    "A specialist reviewed the criteria by hand and the assessment was recomputed from their verdicts.",
  legacy:
    "Produced before the current scoring contract, so the method behind it is not recorded.",
};

/** Wording an employer may see. Never mentions models by vendor or "AI score". */
export const CLIENT_METHOD_LABELS: Record<EvaluationMethod, string> = {
  deterministic: "Structured criteria check",
  semantic: "Structured criteria check",
  human_adjusted: "Reviewed by a specialist",
  legacy: "Earlier assessment",
};

export function methodLabel(raw: string | null | undefined): string {
  return METHOD_LABELS[normalizeEvaluationMethod(raw)];
}

export function methodSentence(raw: string | null | undefined): string {
  return METHOD_SENTENCES[normalizeEvaluationMethod(raw)];
}

export function clientMethodLabel(raw: string | null | undefined): string {
  return CLIENT_METHOD_LABELS[normalizeEvaluationMethod(raw)];
}
