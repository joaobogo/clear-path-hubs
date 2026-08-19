// Deterministic, rule-based candidate scoring engine.
// Runs server-side. Same inputs + same engine version = same output.
// No LLM calls: evidence-first, no hallucinated inference.

import {
  DEFAULT_CALIBRATION,
  EVALUATION_METHOD,
  resolveCalibration,
  type EngineCalibration,
} from "./scoring/engine-calibration";

import { ENGINE_VERSION } from "./scoring/engine-version";
import { cleanQuote } from "./evidence/quote-hygiene";
import { bandToFitLabel, classifyBand } from "./scoring/bands";
import { computeFit } from "./scoring/fit-math";
import { expandTerm } from "./scoring/term-synonyms";

export { ENGINE_VERSION, EVALUATION_METHOD };

export interface RequirementInput {
  id: string;
  text: string;
  required: boolean;
  keywords: string[];
}

export interface ScreeningAnswer {
  question_id: string;
  question: string;
  required: boolean;
  answer_type: string;
  value: unknown;
  disqualifying_condition?: { operator: "equals" | "min" | "max"; value: unknown } | null;
}

export interface EvidenceRef {
  requirement_id: string;
  requirement_text: string;
  source: "cv" | "screening";
  matched_terms: string[];
  snippet: string;
  location: string; // e.g. "cv:1200-1280" or "screening:<qid>"
}

export interface RequirementAssessment {
  id: string;
  text: string;
  required: boolean;
  // "unknown" = insufficient CV text / no evidence yet — needs human validation.
  // Never contributes an irrational 0 to must-have coverage.
  status: "met" | "partial" | "missing" | "unknown" | "contradicted";
  matched_terms: string[];
  evidence: EvidenceRef[];
  needs_validation?: boolean;
}

export interface ScoringResult {
  engine_version: string;
  /** Calibration set that produced these numbers (see engine-calibration.ts). */
  calibration_version: string;
  /** How the numbers were reached. Deterministic — never a model call. */
  evaluation_method: typeof EVALUATION_METHOD;
  /** Composite before any cap was applied, 0-100. */
  raw_score: number;
  /** Caps applied in order, with the value they clamped from. */
  applied_caps: Array<{ reason: string; cap: number; before: number }>;
  score: number; // 0-100
  fit_label: "strong_fit" | "worth_considering" | "not_a_fit" | "unknown";
  overall_confidence: number; // 0-1
  /**
   * How much of the rubric the assessment could actually decide, 0-100,
   * weighted by the category weights in force for this run. A run can be
   * confident overall (long CV, complete screening) while still leaving
   * must-haves undecided — this is the number that says so.
   */
  evidence_confidence: number; // 0-100
  must_have_coverage: number; // 0-1
  preferred_coverage: number; // 0-1
  category_breakdown: {
    must_have: number;
    preferred: number;
    screening_alignment: number;
  };
  /**
   * Weight actually applied to each category for THIS run. A category with no
   * inputs (no preferred requirements, no screening answers) gets weight 0 and
   * the remaining weights are renormalised — absent categories never award
   * free points.
   */
  category_weights: {
    must_have: number;
    preferred: number;
    screening_alignment: number;
  };
  requirement_assessment: RequirementAssessment[];
  strengths: string[];
  concerns: string[];
  evidence: EvidenceRef[];
  screening_evidence: Array<{

    question_id: string;
    question: string;
    normalized_value: string;
    aligned: "aligned" | "misaligned" | "unknown";
  }>;
  contradiction_status: "none" | "screening_contradicts_cv" | "disqualifying_answer";
  completed_at: string;
  input_hash: string;
}

// ---------- helpers ----------

const STOP = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","by","at","from",
  "is","are","be","been","being","was","were","have","has","had","as","this","that",
  "you","your","we","our","their","it","its","not","but","if","then","so","than",
  "will","can","may","must","should","would","using","use","used","across","into",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+.#-]{2,}/g) ?? []).filter((t) => !STOP.has(t));
}

function extractKeywordsFromRequirement(text: string, cap: number): string[] {
  const toks = tokenize(text);
  // Preserve multi-word phrases up to 3 tokens if they look like techs.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of toks) {
    if (t.length < 2) continue;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, cap);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-term match. Prevents substring false positives such as `java` matching
 * `javascript`, or `go` matching `google`. Terms containing punctuation
 * (`node.js`, `c++`, `.net`) still match because only alphanumeric neighbours
 * are rejected.
 */
export function findTermMatches(
  cv: string,
  term: string,
  maxHits: number = DEFAULT_CALIBRATION.max_term_hits,
): number[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`, "gi");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const lower = cv.toLowerCase();
  while ((m = re.exec(lower)) !== null) {
    out.push(m.index + (m[1]?.length ?? 0));
    re.lastIndex = m.index + Math.max(1, m[0].length - 1);
    if (out.length >= maxHits) break;
  }
  return out;
}

/**
 * Bare negators only count when they sit very close to the mention, because
 * "no" appears constantly in prose ("no downtime, shipped Kubernetes").
 */
const SHORT_RANGE_NEGATORS = ["no", "not", "never", "without", "nor", "zero"];

const NEGATION_CUES = [
  "no experience",
  "not experienced",
  "no exposure",
  "no hands-on",
  "never used",
  "never worked",
  "no knowledge",
  "not familiar",
  "unfamiliar with",
  "without any",
  "without",
  "lacks",
  "lack of",
  "no formal",
  "limited to no",
];

/**
 * True when the mention at `idx` sits inside a negating clause, e.g.
 * "no experience with Kubernetes". Only the preceding ~70 characters of the
 * same sentence are considered, so a later positive mention still counts.
 */
export function isNegatedMention(
  cv: string,
  idx: number,
  cal: EngineCalibration = DEFAULT_CALIBRATION,
): boolean {
  const lower = cv.toLowerCase();
  const sentenceStart = Math.max(
    lower.lastIndexOf(".", idx - 1) + 1,
    lower.lastIndexOf("\n", idx - 1) + 1,
    lower.lastIndexOf(";", idx - 1) + 1,
    idx - cal.negation_sentence_window,
    0,
  );
  let window = lower.slice(sentenceStart, idx);
  // Contrastive conjunctions end the negated clause: in "no experience with
  // Kubernetes, but deep Docker work", the negation does not reach Docker.
  for (const pivot of [" but ", " however", " although", " whereas", " though "]) {
    const at = window.lastIndexOf(pivot);
    if (at !== -1) window = window.slice(at + pivot.length);
  }
  if (NEGATION_CUES.some((cue) => window.includes(cue))) return true;
  // Bare negators ("no Kubernetes", "never touched Terraform") need proximity,
  // checked on word boundaries so "nor" never fires inside "normalise".
  const near = window.slice(Math.max(0, window.length - cal.negation_bare_window));
  return SHORT_RANGE_NEGATORS.some((n) =>
    new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`).test(near),
  );
}

function findSnippet(
  cv: string,
  term: string,
  at: number | undefined,
  radius: number,
): { snippet: string; location: string } | null {
  const idx = at ?? cv.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(cv.length, idx + term.length + radius);
  const snippet = cleanQuote(cv.slice(start, end));
  if (!snippet) return null;
  return { snippet, location: `cv:${start}-${end}` };

}


function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function computeInputHash(parts: {
  engine_version: string;
  calibration_version?: string;
  cv_text: string;
  requirements: RequirementInput[];
  screening: ScreeningAnswer[];
}): string {
  const canon = JSON.stringify({
    v: parts.engine_version,
    cal: parts.calibration_version ?? DEFAULT_CALIBRATION.calibration_version,
    c: parts.cv_text.trim().toLowerCase(),
    r: parts.requirements
      .map((r) => ({ id: r.id, text: r.text.trim().toLowerCase(), req: r.required }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    s: parts.screening
      .map((s) => ({ q: s.question_id, v: s.value }))
      .sort((a, b) => a.q.localeCompare(b.q)),
  });
  return `${fnv1a(canon)}-${canon.length.toString(16)}`;
}

function normalizeScreeningValue(a: ScreeningAnswer): string {
  const v = a.value;
  if (v == null || v === "") return "unknown";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v);
}

function screeningAlignment(a: ScreeningAnswer, cvText: string): "aligned" | "misaligned" | "unknown" {
  const norm = normalizeScreeningValue(a);
  if (norm === "unknown") return "unknown";
  if (a.answer_type === "boolean") {
    // A "no" to a required boolean is misaligned; "yes" is aligned.
    return norm === "yes" ? "aligned" : "misaligned";
  }
  if (a.answer_type === "long_text" || a.answer_type === "short_text") {
    const toks = tokenize(norm).slice(0, 5);
    if (toks.length === 0) return "unknown";
    const cv = cvText.toLowerCase();
    return toks.some((t) => cv.includes(t)) ? "aligned" : "unknown";
  }
  return "aligned";
}

function isDisqualifying(a: ScreeningAnswer): boolean {
  const cond = a.disqualifying_condition;
  if (!cond) return false;
  const v = a.value;
  if (cond.operator === "equals") return v === cond.value;
  if (cond.operator === "min" && typeof v === "number" && typeof cond.value === "number") return v < cond.value;
  if (cond.operator === "max" && typeof v === "number" && typeof cond.value === "number") return v > cond.value;
  return false;
}
export type CategoryWeights = {
  must_have: number;
  preferred: number;
  screening_alignment: number;
};

/** Scale a weight set so the present (non-zero) weights sum to exactly 1. */
export function renormaliseWeights(w: CategoryWeights): CategoryWeights {
  const total = w.must_have + w.preferred + w.screening_alignment;
  if (total <= 0) return { must_have: 1, preferred: 0, screening_alignment: 0 };
  const round = (x: number) => Math.round((x / total) * 10000) / 10000;
  return {
    must_have: round(w.must_have),
    preferred: round(w.preferred),
    screening_alignment: round(w.screening_alignment),
  };
}

/**
 * The single canonical combination step. Both the engine and the service-layer
 * reconciliation call this, so a stored run can always be reproduced from its
 * category_breakdown + category_weights.
 */
export function combineCategories(
  breakdown: CategoryWeights,
  weights: CategoryWeights,
): number {
  return (
    breakdown.must_have * weights.must_have +
    breakdown.preferred * weights.preferred +
    breakdown.screening_alignment * weights.screening_alignment
  );
}


// ---------- main entry ----------

export function scoreCandidate(input: {
  cv_text: string;
  requirements: RequirementInput[];
  screening: ScreeningAnswer[];
  /** Role family used to resolve calibration overrides. */
  role_family?: string | null;
  /** Explicit calibration (tests, replay of a historical run). */
  calibration?: EngineCalibration;
}): ScoringResult {
  const cv = input.cv_text ?? "";
  const cal = input.calibration ?? resolveCalibration(input.role_family);
  const engine_version = ENGINE_VERSION;
  const input_hash = computeInputHash({
    engine_version,
    calibration_version: cal.calibration_version,
    cv_text: input.cv_text,
    requirements: input.requirements,
    screening: input.screening,
  });
  const completed_at = new Date().toISOString();

  const requirements = input.requirements.map((r) => ({
    ...r,
    keywords: r.keywords?.length ? r.keywords : extractKeywordsFromRequirement(r.text, cal.keyword_cap),
  }));

  const cvTokens = new Set(tokenize(cv));
  // "Insufficient parse" signal — CV is too short/garbled to draw negative conclusions.
  // Missing keywords in this regime map to `unknown` (validate), never irrational zero.
  const cvIsThin = cv.trim().length < cal.thin_cv_chars || cvTokens.size < cal.thin_cv_tokens;

  const evidence: EvidenceRef[] = [];
  const assessment: RequirementAssessment[] = requirements.map((r) => {
    const matched: string[] = [];
    const negated: string[] = [];
    const localEvidence: EvidenceRef[] = [];
    for (const kw of r.keywords) {
      const k = kw.toLowerCase();
      // Route the term through the synonym table: "k8s" is evidence for
      // "kubernetes", while "java" and "javascript" stay disjoint terms.
      const surfaceForms = expandTerm(k);
      let hits: number[] = [];
      let matchedForm = k;
      for (const form of surfaceForms) {
        const formHits = findTermMatches(cv, form, cal.max_term_hits);
        if (formHits.length > 0) {
          hits = formHits;
          matchedForm = form;
          break;
        }
      }
      if (hits.length === 0) continue;
      const affirmative = hits.filter((idx) => !isNegatedMention(cv, idx, cal));
      if (affirmative.length === 0) {
        // Every mention is inside a negating clause ("no experience with X").
        negated.push(kw);
        const sn = findSnippet(cv, matchedForm, hits[0], cal.snippet_radius_chars);
        if (sn) {
          localEvidence.push({
            requirement_id: r.id,
            requirement_text: r.text,
            source: "cv",
            matched_terms: [kw],
            snippet: sn.snippet,
            location: sn.location,
          });
        }
        continue;
      }
      matched.push(kw);
      const sn = findSnippet(cv, matchedForm, affirmative[0], cal.snippet_radius_chars);
      if (sn) {
        localEvidence.push({
          requirement_id: r.id,
          requirement_text: r.text,
          source: "cv",
          matched_terms: [kw],
          snippet: sn.snippet,
          location: sn.location,
        });
      }
    }
    let status: RequirementAssessment["status"];
    let needs_validation = false;
    if (matched.length === 0 && negated.length > 0) {
      // The CV explicitly denies the requirement — that is contradicting
      // evidence, not merely absent evidence.
      status = "contradicted";
    } else if (matched.length === 0) {
      // If the CV is too thin OR the requirement is one of many with no matches,
      // treat as UNKNOWN (needs validation) rather than a hard MISSING zero.
      if (cvIsThin) {
        status = "unknown";
        needs_validation = true;
      } else {
        status = "missing";
      }
    } else if (
      matched.length >=
      // The floor can never exceed the number of terms the requirement actually
      // has, otherwise a single-term requirement ("HACCP") could only ever
      // reach "partial" no matter how clearly the CV evidences it.
      Math.min(
        r.keywords.length,
        Math.max(cal.met_keyword_floor, Math.ceil(r.keywords.length * cal.met_keyword_ratio)),
      )
    ) {

      status = "met";
    } else {
      status = "partial";
    }
    evidence.push(...localEvidence.slice(0, cal.max_evidence_per_requirement));
    return {
      id: r.id,
      text: r.text,
      required: r.required,
      status,
      matched_terms: matched,
      evidence: localEvidence.slice(0, cal.max_evidence_per_requirement),
      needs_validation,
    };
  });

  // Screening evidence
  const screening_evidence = input.screening.map((s) => ({
    question_id: s.question_id,
    question: s.question,
    normalized_value: normalizeScreeningValue(s),
    aligned: screeningAlignment(s, cv),
  }));

  const disqualifyingAnswers = input.screening.filter(isDisqualifying);
  const disqualified = disqualifyingAnswers.length > 0;
  const disqualifyingQuestions = disqualifyingAnswers.map(
    (s) => (s.question || "").trim() || `question ${s.question_id}`,
  );

  // Contradiction: screening claims yes to a boolean but nothing corroborating in CV.
  // Distinct from "missing evidence" — only flag if the screening asserted a strong claim
  // AND at least one required assessment is missing.
  let contradiction_status: ScoringResult["contradiction_status"] = "none";
  if (disqualified) contradiction_status = "disqualifying_answer";
  else if (
    input.screening.some(
      (s) => s.answer_type === "boolean" && normalizeScreeningValue(s) === "yes",
    ) &&
    assessment.some((a) => a.required && a.status === "missing")
  ) {
    contradiction_status = "screening_contradicts_cv";
  }

  // Category breakdown — "unknown" contributes a neutral 0.4 (validate, not zero).
  // A category with no inputs at all is EXCLUDED from the weighting rather than
  // credited with a neutral half-score (absent ≠ partially satisfied).
  const must = assessment.filter((a) => a.required);
  const pref = assessment.filter((a) => !a.required);
  const scoreOf = (a: RequirementAssessment) =>
    a.status === "met"
      ? 1
      : a.status === "partial"
        ? cal.partial_credit
        : a.status === "unknown"
          ? cal.unknown_credit
          : 0;
  const must_have_coverage = must.length
    ? must.reduce((s, a) => s + scoreOf(a), 0) / must.length
    : 0;
  const preferred_coverage = pref.length
    ? pref.reduce((s, a) => s + scoreOf(a), 0) / pref.length
    : 0;
  const alignedCount = screening_evidence.filter((s) => s.aligned === "aligned").length;
  const misalignedCount = screening_evidence.filter((s) => s.aligned === "misaligned").length;
  const screeningCount = screening_evidence.length;
  const totalScreening = screeningCount || 1;
  const screening_alignment = screeningCount
    ? (alignedCount - misalignedCount) / totalScreening / 2 + 0.5 // 0-1
    : 0;

  // Weighted score via the canonical fit math: applicable criteria only, with
  // absent dimensions REMOVED from the denominator rather than credited with a
  // neutral half-score. A role with must-haves only therefore earns nothing
  // from the preferred or screening dimensions it does not have.
  const fit = computeFit([
    {
      key: "must_have",
      weight_pct: cal.base_weights.must_have * 100,
      criteria: must.map((a) => ({ key: a.id, score: scoreOf(a) * 100 })),
    },
    {
      key: "preferred",
      weight_pct: cal.base_weights.preferred * 100,
      criteria: pref.map((a) => ({ key: a.id, score: scoreOf(a) * 100 })),
    },
    {
      key: "screening_alignment",
      weight_pct: cal.base_weights.screening_alignment * 100,
      criteria: screeningCount
        ? [{ key: "screening", score: screening_alignment * 100 }]
        : [],
    },
  ]);
  const dimensionApplied = (key: string) =>
    (fit.dimensions.find((d) => d.key === key)?.score ?? null) !== null;
  // Reported weights mirror what fit-math actually applied, so a stored run
  // stays reproducible through combineCategories().
  const category_weights = renormaliseWeights({
    must_have: dimensionApplied("must_have") ? cal.base_weights.must_have : 0,
    preferred: dimensionApplied("preferred") ? cal.base_weights.preferred : 0,
    screening_alignment: dimensionApplied("screening_alignment")
      ? cal.base_weights.screening_alignment
      : 0,
  });
  let score01 = (fit.fit_score ?? 0) / 100;
  // Caps are recorded, not just applied: raw_score, applied_caps and score are
  // three distinct facts so the reconciliation actually proves something
  // (audit finding 11 — raw == cap == final proved nothing).
  const raw_score = Math.round(score01 * 1000) / 10;
  const applied_caps: ScoringResult["applied_caps"] = [];
  const applyCap = (reason: string, cap: number) => {
    if (score01 <= cap) return; // not a cap that fired
    applied_caps.push({ reason, cap, before: Math.round(score01 * 10000) / 10000 });
    score01 = cap;
  };
  // 1) A dealbreaker answer. The reason names the question so a reviewer can
  //    see which answer capped the run without opening the screening record.
  if (disqualified) {
    const names = disqualifyingQuestions.length
      ? disqualifyingQuestions.join("; ")
      : "unnamed screening question";
    applyCap(`disqualifying_answer: ${names}`, cal.disqualified_cap);
  }
  // 2) An unparsed CV. We assessed no document, so no confident composite.
  if (cv.trim().length < cal.unreadable_cv_chars) {
    applyCap(
      `unparsed_cv: CV text under ${cal.unreadable_cv_chars} characters could not be extracted`,
      cal.unparsed_cv_cap,
    );
  }
  // 3) Must-have coverage below the rubric floor: the role's core is unproven.
  if (must.length && must_have_coverage < cal.must_have_floor) {
    applyCap(
      `must_have_floor: ${Math.round(must_have_coverage * 100)}% must-have coverage is below the rubric floor of ${Math.round(cal.must_have_floor * 100)}%`,
      cal.must_have_floor_cap,
    );
  }

  const score = Math.round(score01 * 1000) / 10; // 0.0-100.0


  // Confidence: based on evidence volume, CV length, and screening completeness.
  const cw = cal.confidence_weights;
  const cvTokenBoost = Math.min(1, cv.length / cal.confidence_cv_length_target);
  const evidenceBoost = Math.min(
    1,
    evidence.length / Math.max(cal.confidence_evidence_floor, requirements.length),
  );
  const screeningBoost = screeningCount
    ? alignedCount / totalScreening
    : cal.confidence_no_screening_default;
  const confidenceWeightTotal = cw.cv_length + cw.evidence_volume + cw.screening || 1;
  const overall_confidence =
    Math.round(
      ((cvTokenBoost * cw.cv_length +
        evidenceBoost * cw.evidence_volume +
        screeningBoost * cw.screening) /
        confidenceWeightTotal) *
        100,
    ) / 100;

  // Weighted evidence confidence: per requirement, how decided its status is,
  // averaged inside each category and weighted by that category's live weight.
  // "unknown" contributes nothing — an undecided requirement is the whole point
  // of this signal.
  const decidedness = (a: RequirementAssessment): number =>
    a.status === "met"
      ? cal.decidedness.met
      : a.status === "contradicted"
        ? cal.decidedness.contradicted
        : a.status === "missing"
          ? cal.decidedness.missing
          : a.status === "partial"
            ? cal.decidedness.partial
            : cal.decidedness.unknown;
  const avgDecided = (rows: RequirementAssessment[]): number =>
    rows.length ? rows.reduce((t, a) => t + decidedness(a), 0) / rows.length : 0;
  const mustRows = assessment.filter((a) => a.required);
  const prefRows = assessment.filter((a) => !a.required);
  const evidenceWeightTotal =
    category_weights.must_have + category_weights.preferred + category_weights.screening_alignment;
  const evidencedRows = assessment.filter((a) => a.status === "met" || a.status === "partial");
  const evidence_confidence =
    assessment.length > 0
      ? Math.round((evidencedRows.length / assessment.length) * 100)
      : 0;

  // Bands come from the canonical band table (src/lib/scoring/bands.ts); the
  // engine only decides the non-numeric overrides (disqualification, and CVs
  // whose text could not be extracted, which are "unknown", not "not a fit").
  const canonicalBand = classifyBand(score);
  const fit_label: ScoringResult["fit_label"] = disqualified
    ? "not_a_fit"
    : cv.trim().length < cal.unreadable_cv_chars
      ? "unknown"
      : bandToFitLabel(canonicalBand) === "strong_fit" &&
          must_have_coverage < cal.strong_fit.min_must_have_coverage
        ? "worth_considering"
        : bandToFitLabel(canonicalBand);

  const strengths: string[] = assessment
    .filter((a) => a.status === "met")
    .slice(0, 5)
    .map((a) => `Demonstrated: ${a.text}`);
  const concerns: string[] = assessment
    .filter((a) => a.required && a.status !== "met")
    .slice(0, 5)
    .map((a) =>
      a.status === "unknown"
        ? `Insufficient evidence — validate: ${a.text}`
        : a.status === "missing"
          ? `No evidence of required: ${a.text}`
          : a.status === "contradicted"
            ? `Contradicting evidence for required: ${a.text}`
            : `Only partial evidence for required: ${a.text}`,
    );
  if (contradiction_status !== "none") {
    concerns.unshift(`Screening/CV contradiction (${contradiction_status.replace(/_/g, " ")}).`);
  }
  if (cv.trim().length < cal.unreadable_cv_chars) {
    concerns.push("CV text could not be extracted with confidence.");
  }

  return {
    engine_version,
    calibration_version: cal.calibration_version,
    evaluation_method: EVALUATION_METHOD,
    raw_score,
    applied_caps,
    score,
    fit_label,
    overall_confidence,
    evidence_confidence,
    must_have_coverage: Math.round(must_have_coverage * 10000) / 10000,
    preferred_coverage: Math.round(preferred_coverage * 10000) / 10000,
    category_breakdown: {
      must_have: Math.round(must_have_coverage * 10000) / 10000,
      preferred: Math.round(preferred_coverage * 10000) / 10000,
      screening_alignment: Math.round(screening_alignment * 10000) / 10000,
    },
    category_weights,

    requirement_assessment: assessment,
    strengths,
    concerns,
    evidence: evidence.slice(0, cal.keyword_cap),
    screening_evidence,
    contradiction_status,
    completed_at,
    input_hash,
  };
}
