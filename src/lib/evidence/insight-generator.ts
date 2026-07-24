/**
 * Deterministic insight generation from APPROVED evidence only.
 * Never fabricates. If evidence is missing or generic, returns [] — the UI
 * must fall back to honest empty states, not generic filler.
 */

export type EvidenceItem = {
  id: string;
  rubric_criterion_key: string;
  rubric_dimension_key: string;
  result: string | null;
  match_type: string;
  confidence: number; // 0..1
  factual_quote: string;
  interpretation: string;
  validation_need: string | null;
};

export type CandidateInsights = {
  strengths: Array<{ criterion: string; quote: string; interpretation: string }>;
  trueGaps: Array<{ criterion: string; reason: string }>;
  contradictions: Array<{ criterion: string; quote: string; note: string }>;
  interviewQuestions: Array<{ criterion: string; question: string }>;
};

const isStrong = (e: EvidenceItem) =>
  (e.result === 'strong' || e.result === 'partial') && e.confidence >= 0.7;

const isGap = (e: EvidenceItem) =>
  e.result === 'missing' || e.result === 'weak';

const isContradiction = (e: EvidenceItem) =>
  e.result === 'contradictory' || e.match_type === 'conflicting';

const needsValidation = (e: EvidenceItem) =>
  e.result === 'needs_validation' || (Boolean(e.validation_need) && e.confidence < 0.6);

function criterionLabel(key: string) {
  return key.replace(/[_\-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function generateInsights(items: EvidenceItem[]): CandidateInsights {
  const strengths = items
    .filter(isStrong)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((e) => ({
      criterion: criterionLabel(e.rubric_criterion_key),
      quote: e.factual_quote.slice(0, 240),
      interpretation: e.interpretation,
    }));

  const trueGaps = items
    .filter(isGap)
    .slice(0, 5)
    .map((e) => ({
      criterion: criterionLabel(e.rubric_criterion_key),
      reason: e.result === 'missing'
        ? 'No evidence found in CV or application.'
        : (e.interpretation || 'Signal too weak to substantiate this criterion.'),
    }));

  const contradictions = items
    .filter(isContradiction)
    .map((e) => ({
      criterion: criterionLabel(e.rubric_criterion_key),
      quote: e.factual_quote.slice(0, 240),
      note: e.interpretation || 'Evidence contradicts a stated requirement.',
    }));

  const interviewQuestions = items
    .filter(needsValidation)
    .map((e) => {
      const label = criterionLabel(e.rubric_criterion_key);
      // Prefer the model-authored validation_need; fall back to a
      // criterion-specific (not generic) question grounded in the quote.
      const q = (e.validation_need && e.validation_need.trim())
        || `You mentioned "${e.factual_quote.slice(0, 120).trim()}". Walk us through the ${label.toLowerCase()} decisions you owned and the measurable outcome.`;
      return { criterion: label, question: q };
    })
    .slice(0, 6);

  return { strengths, trueGaps, contradictions, interviewQuestions };
}
