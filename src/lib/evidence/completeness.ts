/**
 * Evidence completeness gate — pure logic.
 *
 * Maps a position's stated requirements onto whatever evidence actually exists
 * for a candidate match (structured evidence items, plus the requirement
 * assessment recorded on the score run) and decides whether the match may be
 * submitted to the client.
 *
 * Nothing here generates evidence or justifications. It only reports what is
 * present, what is missing, and which gaps a human has explicitly overridden.
 */

export type CriterionStatus = "supported" | "thin" | "unsupported";

export interface EvidenceSourceView {
  /** Where this came from: CV, application answer, interview, manual entry, scoring run. */
  source: string;
  snippet: string | null;
  /** Raw verdict as recorded upstream (strong / partial / met / missing …). */
  result: string | null;
  confidence: number | null;
  evidenceItemId: string | null;
  reviewerStatus: string | null;
  integrityOk: boolean;
}

export interface CriterionOverrideView {
  reason: string;
  actorUserId: string | null;
  actorName: string | null;
  at: string;
}

export interface CriterionRow {
  key: string;
  label: string;
  required: boolean;
  status: CriterionStatus;
  sources: EvidenceSourceView[];
  override: CriterionOverrideView | null;
}

export interface CompletenessReport {
  criteria: CriterionRow[];
  requiredTotal: number;
  requiredSupported: number;
  /** Labels of must-have criteria with zero evidence and no override. */
  blockingLabels: string[];
  /** Must-have criteria with zero evidence, whether or not overridden. */
  unsupportedRequiredKeys: string[];
  hasAnyEvidence: boolean;
  canSubmit: boolean;
}

export interface RawRequirement {
  label: string;
  required: boolean;
}

export interface RawEvidenceItem {
  id: string;
  rubric_criterion_key: string | null;
  rubric_dimension_key: string | null;
  source_passage: string | null;
  normalized_meaning: string | null;
  result: string | null;
  confidence: number | string | null;
  source_kind: string | null;
  reviewer_status: string | null;
  integrity_ok: boolean | null;
}

export interface RawAssessment {
  label: string;
  result: string | null;
  snippet: string | null;
  confidence: number | null;
}

export interface RawGateOverride {
  criterionKey: string;
  reason: string;
  actorUserId: string | null;
  actorName: string | null;
  at: string;
}

const STRONG = new Set(["strong", "met", "yes", "true", "pass", "confirmed", "supported"]);
const WEAK = new Set(["partial", "weak", "probable", "likely", "needs_validation", "unclear"]);
const EMPTY = new Set(["missing", "none", "no", "false", "not_found", "unsupported", "not_applicable"]);

export function slugifyCriterion(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Loose label match: identical slug, or one normalized label contains the other. */
function labelsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (slugifyCriterion(a) === slugifyCriterion(b)) return true;
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  return false;
}

function resultRank(result: string | null): 2 | 1 | 0 {
  const r = (result ?? "").toLowerCase().trim();
  if (STRONG.has(r)) return 2;
  if (WEAK.has(r)) return 1;
  if (EMPTY.has(r)) return 0;
  // Unknown verdict with a real quote still counts as thin evidence.
  return r ? 1 : 0;
}

function statusFor(sources: EvidenceSourceView[]): CriterionStatus {
  let best = 0;
  for (const s of sources) {
    const rank = resultRank(s.result);
    const usable = rank > 0 || !!s.snippet;
    if (!usable) continue;
    if (s.reviewerStatus === "rejected" || s.integrityOk === false) continue;
    best = Math.max(best, rank === 0 ? 1 : rank);
  }
  if (best >= 2) return "supported";
  if (best === 1) return "thin";
  return "unsupported";
}

export function buildCompletenessReport(input: {
  requirements: RawRequirement[];
  items: RawEvidenceItem[];
  assessments: RawAssessment[];
  overrides: RawGateOverride[];
}): CompletenessReport {
  const overrideByKey = new Map(input.overrides.map((o) => [o.criterionKey, o]));

  const itemSource = (it: RawEvidenceItem): EvidenceSourceView => ({
    source: it.source_kind ?? "evidence",
    snippet: it.source_passage ?? it.normalized_meaning ?? null,
    result: it.result,
    confidence: it.confidence == null ? null : Number(it.confidence),
    evidenceItemId: it.id,
    reviewerStatus: it.reviewer_status ?? null,
    integrityOk: it.integrity_ok !== false,
  });

  const assessmentSource = (a: RawAssessment): EvidenceSourceView => ({
    source: "scoring run",
    snippet: a.snippet,
    result: a.result,
    confidence: a.confidence,
    evidenceItemId: null,
    reviewerStatus: null,
    integrityOk: true,
  });

  const usedItems = new Set<string>();
  const criteria: CriterionRow[] = [];

  for (const req of input.requirements) {
    const key = slugifyCriterion(req.label);
    if (!key || criteria.some((c) => c.key === key)) continue;
    const sources: EvidenceSourceView[] = [];

    for (const it of input.items) {
      const candidateLabels = [it.rubric_criterion_key ?? "", it.normalized_meaning ?? ""];
      if (candidateLabels.some((l) => labelsMatch(l, req.label))) {
        sources.push(itemSource(it));
        usedItems.add(it.id);
      }
    }
    for (const a of input.assessments) {
      if (labelsMatch(a.label, req.label)) sources.push(assessmentSource(a));
    }

    criteria.push({
      key,
      label: req.label,
      required: req.required,
      status: statusFor(sources),
      sources,
      override: overrideByKey.get(key) ?? null,
    });
  }

  // Evidence that exists but maps to no stated requirement is still shown, so
  // reviewers can see the full picture (never counted toward the gate).
  for (const it of input.items) {
    if (usedItems.has(it.id)) continue;
    const label = it.rubric_criterion_key ?? it.rubric_dimension_key ?? "Unmapped evidence";
    const key = `unmapped:${slugifyCriterion(label)}:${it.id.slice(0, 8)}`;
    criteria.push({
      key,
      label,
      required: false,
      status: statusFor([itemSource(it)]),
      sources: [itemSource(it)],
      override: null,
    });
  }

  const required = criteria.filter((c) => c.required);
  const unsupportedRequired = required.filter((c) => c.status === "unsupported");
  const blocking = unsupportedRequired.filter((c) => !c.override);

  return {
    criteria,
    requiredTotal: required.length,
    requiredSupported: required.filter((c) => c.status !== "unsupported").length,
    blockingLabels: blocking.map((c) => c.label),
    unsupportedRequiredKeys: unsupportedRequired.map((c) => c.key),
    hasAnyEvidence: input.items.length > 0 || input.assessments.length > 0,
    canSubmit: blocking.length === 0,
  };
}

export const GATE_OVERRIDE_ACTION = "evidence_gate_override";
