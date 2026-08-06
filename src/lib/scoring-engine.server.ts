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
export function findTermMatches(cv: string, term: string): number[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(t)}([^a-z0-9]|$)`, "gi");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const lower = cv.toLowerCase();
  while ((m = re.exec(lower)) !== null) {
    out.push(m.index + (m[1]?.length ?? 0));
    re.lastIndex = m.index + Math.max(1, m[0].length - 1);
    if (out.length >= 5) break;
  }
  return out;
}

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
export function isNegatedMention(cv: string, idx: number): boolean {
  const lower = cv.toLowerCase();
  const sentenceStart = Math.max(
    lower.lastIndexOf(".", idx - 1) + 1,
    lower.lastIndexOf("\n", idx - 1) + 1,
    lower.lastIndexOf(";", idx - 1) + 1,
    idx - 70,
    0,
  );
  const window = lower.slice(sentenceStart, idx);
  return NEGATION_CUES.some((cue) => window.includes(cue));
}

function findSnippet(cv: string, term: string, at?: number): { snippet: string; location: string } | null {
  const idx = at ?? cv.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - 80);
  const end = Math.min(cv.length, idx + term.length + 80);
  const snippet = cv.slice(start, end).replace(/\s+/g, " ").trim();
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
      const hits = findTermMatches(cv, k);
      if (hits.length === 0) continue;
      const affirmative = hits.filter((idx) => !isNegatedMention(cv, idx));
      if (affirmative.length === 0) {
        // Every mention is inside a negating clause ("no experience with X").
        negated.push(kw);
        const sn = findSnippet(cv, k, hits[0]);
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
      const sn = findSnippet(cv, k, affirmative[0]);
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
      Math.max(cal.met_keyword_floor, Math.ceil(r.keywords.length * cal.met_keyword_ratio))
    ) {

      status = "met";
    } else {
      status = "partial";
    }
    evidence.push(...localEvidence.slice(0, 2));
    return {
      id: r.id,
      text: r.text,
      required: r.required,
      status,
      matched_terms: matched,
      evidence: localEvidence.slice(0, 2),
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

  const disqualified = input.screening.some(isDisqualifying);

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

  // Weighted score: must-haves dominate. Absent categories drop out and the
  // remaining weights are renormalised so nothing earns free points.
  const category_weights = renormaliseWeights({
    must_have: must.length ? cal.base_weights.must_have : 0,
    preferred: pref.length ? cal.base_weights.preferred : 0,
    screening_alignment: screeningCount ? cal.base_weights.screening_alignment : 0,
  });
  let score01 = combineCategories(
    {
      must_have: must_have_coverage,
      preferred: preferred_coverage,
      screening_alignment,
    },
    category_weights,
  );
  // Caps are recorded, not just applied: raw_score, applied_caps and score are
  // three distinct facts so the reconciliation actually proves something
  // (audit finding 11 — raw == cap == final proved nothing).
  const raw_score = Math.round(score01 * 1000) / 10;
  const applied_caps: ScoringResult["applied_caps"] = [];
  if (disqualified && score01 > cal.disqualified_cap) {
    applied_caps.push({
      reason: "disqualifying_answer",
      cap: cal.disqualified_cap,
      before: Math.round(score01 * 10000) / 10000,
    });
  }
  if (disqualified) score01 = Math.min(score01, cal.disqualified_cap);

  const score = Math.round(score01 * 1000) / 10; // 0.0-100.0


  // Confidence: based on evidence volume, CV length, and screening completeness.
  const cvTokenBoost = Math.min(1, cv.length / 800);
  const evidenceBoost = Math.min(1, evidence.length / Math.max(3, requirements.length));
  const screeningBoost = totalScreening ? alignedCount / totalScreening : 0.5;
  const overall_confidence =
    Math.round(((cvTokenBoost * 0.4 + evidenceBoost * 0.4 + screeningBoost * 0.2)) * 100) / 100;

  // Bands come from the canonical band table (src/lib/scoring/bands.ts); the
  // engine only decides the non-numeric overrides (disqualification, and CVs
  // whose text could not be extracted, which are "unknown", not "not a fit").
  const canonicalBand = classifyBand(score);
  const fit_label: ScoringResult["fit_label"] = disqualified
    ? "not_a_fit"
    : cv.trim().length < 60
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
  if (cv.trim().length < 60) {
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
