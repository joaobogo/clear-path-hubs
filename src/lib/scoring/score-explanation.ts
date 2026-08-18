/**
 * Score and band explanations — Prompt 11.
 *
 * A figure or a band never appears on a human surface on its own. Every
 * explanation states:
 *
 *   1. the method that produced the assessment (truthfully — see
 *      `evaluation-method.ts`; "hybrid" is not a method),
 *   2. the criteria that were assessed, each with the evidence snippet behind
 *      its verdict.
 *
 * When a surface cannot supply criteria with evidence, it does not get to print
 * a figure: `buildScoreExplanation` returns an `evidence_pending` shape and the
 * surface shows the band with "Evidence pending" instead.
 *
 * Candidate audience: the language is screening and application review. No
 * score, no band, no "AI score" — ever.
 */
import {
  clientMethodLabel,
  methodLabel,
  methodSentence,
  normalizeEvaluationMethod,
  type EvaluationMethod,
} from "./evaluation-method";
import {
  evidencedNumber,
  type EvidencePath,
  type EvidencedNumber,
} from "./evidenced-number";

export type ExplanationAudience = "staff" | "client" | "candidate";

export type CriterionVerdict = "met" | "partial" | "missing" | "unknown" | "not_applicable";

export type ExplanationCriterion = {
  id?: string | null;
  label: string;
  importance?: "must_have" | "preferred" | null;
  verdict: CriterionVerdict;
  /** Quoted text from the CV or an answer. Required for the criterion to count. */
  evidence_snippet?: string | null;
  /** Where the snippet came from: "CV", "Screening answer", "Specialist review". */
  source?: string | null;
  /** True when a reviewer set this verdict by hand. */
  human_verified?: boolean;
};

export type ExplainedCriterion = ExplanationCriterion & {
  evidence_snippet: string | null;
  verdict_label: string;
  evidenced: boolean;
};

export type ScoreExplanation =
  | {
      kind: "explained";
      method: EvaluationMethod;
      method_label: string;
      method_sentence: string;
      /** Present for staff only; client and candidate surfaces get no figure. */
      number: EvidencedNumber | null;
      band_label: string | null;
      criteria: ExplainedCriterion[];
      criteria_summary: string;
      evidenced_count: number;
      assessed_count: number;
    }
  | {
      kind: "evidence_pending";
      method: EvaluationMethod;
      method_label: string;
      band_label: string | null;
      /** Always "Assessment being finalised — evidence pending", for direct rendering. */
      headline: string;
      /** Detailed explanation for why evidence is pending. */
      summary: string;
      criteria: ExplainedCriterion[];
    };

const VERDICT_LABELS: Record<CriterionVerdict, string> = {
  met: "Met",
  partial: "Partly met",
  missing: "Not evidenced",
  unknown: "Not determined",
  not_applicable: "Not applicable",
};

const MAX_SNIPPET = 240;

function snippet(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET - 1)}…` : text;
}

export function explainCriterion(c: ExplanationCriterion): ExplainedCriterion {
  const snip = snippet(c.evidence_snippet);
  return {
    ...c,
    evidence_snippet: snip,
    verdict_label: VERDICT_LABELS[c.verdict] ?? VERDICT_LABELS.unknown,
    // A verdict with no quoted text is not evidence, however confident it looks.
    evidenced: Boolean(snip) || c.human_verified === true,
  };
}

/** One line naming the criteria behind a figure. Never empty when evidenced. */
export function criteriaSummary(criteria: ExplainedCriterion[]): string {
  const evidenced = criteria.filter((c) => c.evidenced);
  if (evidenced.length === 0) return "";
  const musts = evidenced.filter((c) => c.importance === "must_have");
  const met = evidenced.filter((c) => c.verdict === "met").length;
  const head = `${met} of ${criteria.length} criteria evidenced as met`;
  const named = evidenced
    .slice(0, 3)
    .map((c) => `${c.label} — ${c.verdict_label.toLowerCase()}`)
    .join("; ");
  const mustNote = musts.length ? ` (${musts.length} must-have)` : "";
  return `${head}${mustNote}: ${named}`;
}

export function buildScoreExplanation(input: {
  audience: ExplanationAudience;
  /** Raw `score_runs.evaluation_method`. */
  method: string | null | undefined;
  /** Internal 0-100. Ignored for client and candidate audiences. */
  score?: number | null;
  /** Band wording already resolved by the caller (client-fit-presentation). */
  bandLabel?: string | null;
  criteria: ExplanationCriterion[];
  /** Where a human sees the underlying evidence. */
  evidencePath?: EvidencePath | null;
  caveat?: string | null;
}): ScoreExplanation {
  const method = normalizeEvaluationMethod(input.method);
  const explained = input.criteria.map(explainCriterion);
  const evidencedCount = explained.filter((c) => c.evidenced).length;
  const isCandidate = input.audience === "candidate";
  const label = isCandidate
    ? "Application review"
    : input.audience === "client"
      ? clientMethodLabel(method)
      : methodLabel(method);

  // Candidate surfaces never receive a band or a figure at all.
  const bandLabel = isCandidate ? null : (input.bandLabel ?? null);

  if (evidencedCount === 0 || !input.evidencePath) {
    return {
      kind: "evidence_pending",
      method,
      method_label: label,
      band_label: bandLabel,
      headline: "Assessment being finalised — evidence pending",
      summary: !input.evidencePath
        ? "The supporting evidence is not available on this surface yet."
        : "The candidate's score is calculated, but our team is currently verifying the evidence snippets and quotes from their background to ensure full accuracy before final delivery.",
      criteria: explained,
    };
  }

  const summary = criteriaSummary(explained);
  // Employers see the figure too — but only ever as an evidenced number, with
  // its criteria line, its method and a path to the evidence. Candidates never
  // receive a figure at all.
  const number =
    input.audience !== "candidate"
      ? evidencedNumber({
          value: input.score ?? null,
          label: "Fit",
          criteria_summary: summary,
          method,
          evidence: input.evidencePath,
          caveat: input.caveat ?? null,
        })
      : null;

  return {
    kind: "explained",
    method,
    method_label: label,
    method_sentence: isCandidate
      ? "Your application was reviewed against the role's written requirements."
      : methodSentence(method),
    number,
    band_label: bandLabel,
    criteria: explained,
    criteria_summary: summary,
    evidenced_count: evidencedCount,
    assessed_count: explained.length,
  };
}

/**
 * Guard for candidate-facing text. Screening and application review only —
 * never a score, a band, or the phrase "AI score".
 */
const CANDIDATE_FORBIDDEN = [
  /\bai\s*score\b/i,
  /\bscore\b/i,
  /\bscored\b/i,
  /\bfit\s*band\b/i,
  /\branked?\b/i,
  /\b\d{1,3}\s*\/\s*100\b/,
];

export function assertCandidateSafeCopy(text: string): void {
  const hit = CANDIDATE_FORBIDDEN.find((re) => re.test(text));
  if (hit) {
    throw new Error(
      `Candidate-facing copy must speak of screening and application review, not scores: ${text}`,
    );
  }
}

export function isCandidateSafeCopy(text: string): boolean {
  try {
    assertCandidateSafeCopy(text);
    return true;
  } catch {
    return false;
  }
}
