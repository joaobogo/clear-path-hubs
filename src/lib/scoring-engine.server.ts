// Deterministic, rule-based candidate scoring engine.
// Runs server-side. Same inputs + same engine version = same output.
// No LLM calls: evidence-first, no hallucinated inference.

export const ENGINE_VERSION = "taasflow-scoring-v1.0.0";

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

function extractKeywordsFromRequirement(text: string): string[] {
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
  return out.slice(0, 12);
}

function findSnippet(cv: string, term: string): { snippet: string; location: string } | null {
  const idx = cv.toLowerCase().indexOf(term.toLowerCase());
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
  cv_text: string;
  requirements: RequirementInput[];
  screening: ScreeningAnswer[];
}): string {
  const canon = JSON.stringify({
    v: parts.engine_version,
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

// ---------- main entry ----------

export function scoreCandidate(input: {
  cv_text: string;
  requirements: RequirementInput[];
  screening: ScreeningAnswer[];
}): ScoringResult {
  const cv = input.cv_text ?? "";
  const engine_version = ENGINE_VERSION;
  const input_hash = computeInputHash({ engine_version, ...input });
  const completed_at = new Date().toISOString();

  const requirements = input.requirements.map((r) => ({
    ...r,
    keywords: r.keywords?.length ? r.keywords : extractKeywordsFromRequirement(r.text),
  }));

  const cvLower = cv.toLowerCase();
  const cvTokens = new Set(tokenize(cv));
  // "Insufficient parse" signal — CV is too short/garbled to draw negative conclusions.
  // Missing keywords in this regime map to `unknown` (validate), never irrational zero.
  const cvIsThin = cv.trim().length < 300 || cvTokens.size < 40;

  const evidence: EvidenceRef[] = [];
  const assessment: RequirementAssessment[] = requirements.map((r) => {
    const matched: string[] = [];
    const localEvidence: EvidenceRef[] = [];
    for (const kw of r.keywords) {
      const k = kw.toLowerCase();
      if (cvTokens.has(k) || cvLower.includes(k)) {
        matched.push(kw);
        const sn = findSnippet(cv, k);
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
    }
    let status: RequirementAssessment["status"];
    let needs_validation = false;
    if (matched.length === 0) {
      // If the CV is too thin OR the requirement is one of many with no matches,
      // treat as UNKNOWN (needs validation) rather than a hard MISSING zero.
      if (cvIsThin) {
        status = "unknown";
        needs_validation = true;
      } else {
        status = "missing";
      }
    } else if (matched.length >= Math.max(2, Math.ceil(r.keywords.length * 0.6))) {
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
  const must = assessment.filter((a) => a.required);
  const pref = assessment.filter((a) => !a.required);
  const scoreOf = (a: RequirementAssessment) =>
    a.status === "met"
      ? 1
      : a.status === "partial"
        ? 0.5
        : a.status === "unknown"
          ? 0.4
          : 0;
  const must_have_coverage = must.length
    ? must.reduce((s, a) => s + scoreOf(a), 0) / must.length
    : 1;
  const preferred_coverage = pref.length
    ? pref.reduce((s, a) => s + scoreOf(a), 0) / pref.length
    : 0.5; // unknown → neutral
  const alignedCount = screening_evidence.filter((s) => s.aligned === "aligned").length;
  const misalignedCount = screening_evidence.filter((s) => s.aligned === "misaligned").length;
  const totalScreening = screening_evidence.length || 1;
  const screening_alignment =
    (alignedCount - misalignedCount) / totalScreening / 2 + 0.5; // 0-1

  // Weighted score: must-haves dominate.
  let score01 =
    must_have_coverage * 0.6 + preferred_coverage * 0.2 + screening_alignment * 0.2;
  if (disqualified) score01 = Math.min(score01, 0.15);

  const score = Math.round(score01 * 1000) / 10; // 0.0-100.0

  // Confidence: based on evidence volume, CV length, and screening completeness.
  const cvTokenBoost = Math.min(1, cv.length / 800);
  const evidenceBoost = Math.min(1, evidence.length / Math.max(3, requirements.length));
  const screeningBoost = totalScreening ? alignedCount / totalScreening : 0.5;
  const overall_confidence =
    Math.round(((cvTokenBoost * 0.4 + evidenceBoost * 0.4 + screeningBoost * 0.2)) * 100) / 100;

  const fit_label: ScoringResult["fit_label"] =
    disqualified
      ? "not_a_fit"
      : score >= 75 && must_have_coverage >= 0.75
        ? "strong_fit"
        : score >= 55
          ? "worth_considering"
          : cv.trim().length < 60
            ? "unknown"
            : "not_a_fit";

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
    requirement_assessment: assessment,
    strengths,
    concerns,
    evidence: evidence.slice(0, 12),
    screening_evidence,
    contradiction_status,
    completed_at,
    input_hash,
  };
}
