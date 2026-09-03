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
import { deriveStrengths } from "./scoring/strengths";
import { computeFit } from "./scoring/fit-math";
import { expandTerm } from "./scoring/term-synonyms";
import { measureSubstance, type SubstanceMeasure } from "./scoring/evidence-substance";

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
  /**
   * The specific answer/requirement pairs behind a screening_contradicts_cv
   * flag. Empty unless the status is raised — a flag with no rows to resolve
   * cannot be actioned by a reviewer and must not exist.
   */
  contradiction_rows: Array<{
    question_id: string;
    question: string;
    requirement: string;
  }>;
  /**
   * How much substance sits around the matched terms — the anti keyword-echo
   * measure. A run whose evidence is a keyword list is capped, never presented
   * as a top band, however many rubric terms it contains.
   */
  evidence_substance: SubstanceMeasure;
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

/**
 * Words that describe HAVING a skill rather than naming one.
 *
 * A requirement is written as a sentence — "Practical experience with
 * row-level security or another multi-tenant isolation model" — but only some
 * of those words are the capability. The rest are framing: degree, quantity,
 * possession. They almost never appear in a CV in that form, yet every one of
 * them used to become a keyword, and `met` needs 60% of the keywords matched.
 *
 * That requirement produced eight keywords, four of which ("practical",
 * "experience", "another", plus the connectives already dropped as stopwords)
 * carry no signal at all — so a candidate who wrote "per-tenant data isolation
 * audited twice a year" could match the real terms and still land at
 * "partly evidenced", because the noise words dragged the ratio down.
 *
 * Deliberately conservative: only possession/degree/quantifier words. Nothing
 * that can name a capability. "model", "team", "management", "design" and the
 * like stay, because they are content in some requirements even when they read
 * as filler in others — and a false drop silently loses real evidence, which
 * is the failure this table exists to prevent.
 */
const REQUIREMENT_FRAMING = new Set([
  // possession / degree. Hyphenated forms are listed explicitly because
  // tokenize keeps hyphens, so "hands-on" arrives as one token — the reason
  // the Docker fixture below still read "partial" on the first attempt.
  // NB "end-to-end" is deliberately NOT here: in "automated tests (unit and
  // end-to-end)" it names the capability, and a false drop loses real
  // evidence — the failure this table exists to prevent.
  "experience", "experienced", "practical", "hands", "handson", "hands-on",
  "in-depth", "well-versed", "day-to-day", "strong",
  "solid", "proven", "demonstrable", "demonstrated", "deep", "excellent",
  "good", "great", "ability", "able", "capable", "knowledge", "understanding",
  "familiarity", "familiar", "comfortable", "confident", "expertise", "expert",
  "background", "track", "record", "skilled", "competent", "fluency",
  // quantity / qualification
  "years", "year", "minimum", "least", "plus", "ideally", "preferably",
  "bonus", "nice", "desirable", "required", "requirement", "essential",
  "another", "similar", "equivalent", "relevant", "appropriate", "various",
  "multiple", "several", "strongly", "highly", "well", "very",
  // sentence scaffolding the stopword list does not cover
  "including", "include", "includes", "etc", "such", "able", "willing",
  "working", "work", "role", "position", "candidate", "candidates",
  // Elaboration noise (v1.5.0). These words elaborate a capability the
  // requirement already names, and several of them double as CV SECTION
  // HEADERS ("PROFESSIONAL EXPERIENCE", "TECHNICAL SKILLS") — so they granted
  // free keyword credit to any CV with standard English headings while a
  // Portuguese CV with identical substance could not match them. A
  // requirement written ENTIRELY in these words still matches via the
  // zero-keyword fallback below.
  "professional", "skills", "skill", "speaking", "communication",
  "principles", "fundamentals", "practices", "best", "part", "technical",
  "independently", "effectively", "efficiently",
]);

function extractKeywordsFromRequirement(text: string, cap: number): string[] {
  const toks = tokenize(text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of toks) {
    if (t.length < 2) continue;
    if (REQUIREMENT_FRAMING.has(t)) continue;
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  // A requirement written entirely in framing words still has to be matchable
  // against something, so fall back to the unfiltered tokens rather than
  // producing zero keywords (which would read as "no evidence possible").
  if (out.length === 0) {
    for (const t of toks) {
      if (t.length >= 2 && !seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
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
/**
 * Safe morphological variants of a term (v1.5.0).
 *
 * The matcher deliberately has no stemming — "java" must never reach
 * "javascript". But zero inflection meant "workflow" could not match
 * "workflows" and "diagnose" could not match "diagnosing", which punished
 * candidates for grammar. These are purely additive suffix forms of terms of
 * SIX or more characters (so "react" can never generate "reacting", and
 * short ambiguous names — go, java, vue — are untouched), plus a plural
 * strip. Word-boundary anchoring still applies to every variant.
 */
const MIN_INFLECT_LEN = 6;
export function inflectionVariants(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (t.length < MIN_INFLECT_LEN || !/^[a-z]+$/.test(t)) return [];
  const out: string[] = [];
  out.push(`${t}s`, `${t}es`, `${t}ed`, `${t}ing`);
  if (t.endsWith("e")) out.push(`${t.slice(0, -1)}ing`, `${t}d`);
  if (t.endsWith("s")) out.push(t.slice(0, -1));
  return out;
}

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
  // Self-deprecating qualifiers a candidate writes about a weaker skill. A
  // screening answer reading "I'm less experienced with React/Supabase"
  // credited Supabase as MET (audit #4, M6) — the sentence says the opposite.
  "less experienced",
  "least experienced",
  "little experience",
  "minimal experience",
  "some exposure to",
  "still learning",
  "beginner",
  "basic knowledge",
  "not yet used",
  "yet to use",
  "would like to learn",
  "want to learn",
  "keen to learn",
  "no professional experience",
  // Portuguese equivalents — the roster is Brazil-based.
  "pouca experiência",
  "pouca experiencia",
  "sem experiência",
  "sem experiencia",
  "estou aprendendo",
  "básico",
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

const isWordChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9]/.test(c);

/**
 * A fixed-radius slice lands mid-word; move the bounds to the nearest word
 * boundary so every quote begins and ends on a whole word.
 */
function snapToWordBounds(cv: string, start: number, end: number, guardLo: number, guardHi: number): [number, number] {
  let s = start;
  if (s > 0 && isWordChar(cv[s - 1]) && isWordChar(cv[s])) {
    // Mid-word: skip the partial token, then any separators after it.
    while (s < guardHi && isWordChar(cv[s])) s++;
    while (s < guardHi && !isWordChar(cv[s])) s++;
  }
  let e = end;
  if (e < cv.length && isWordChar(cv[e - 1]) && isWordChar(cv[e])) {
    // Mid-word: retreat past the partial token, then any separators before it.
    while (e > guardLo && isWordChar(cv[e - 1])) e--;
    while (e > guardLo && !isWordChar(cv[e - 1])) e--;
  }
  return [s, Math.max(e, s)];
}

function findSnippet(
  cv: string,
  term: string,
  at: number | undefined,
  radius: number,
): { snippet: string; location: string } | null {
  const idx = at ?? cv.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return null;
  const rawStart = Math.max(0, idx - radius);
  const rawEnd = Math.min(cv.length, idx + term.length + radius);
  const [start, end] = snapToWordBounds(cv, rawStart, rawEnd, idx + term.length, idx);
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

  // Screening answers are part of the evidence corpus (v1.5.0). The Score tab
  // has always promised evidence "from the CV or screening answers" — the
  // engine now honours it: a requirement keyword found in an answer's text is
  // evidence with source "screening". ONLY the answer value is scanned — the
  // question's own wording contains the requirement's words by construction,
  // so scanning it would hand every candidate free credit for being asked.
  const screeningCorpus = input.screening
    .map((s) => ({
      question_id: s.question_id,
      text: normalizeScreeningValue(s),
    }))
    // yes/no/unknown carry no describable content; the linked-answer floor
    // below is what credits an affirmative boolean.
    .filter((s) => s.text.length >= 8);

  const evidence: EvidenceRef[] = [];
  const assessment: RequirementAssessment[] = requirements.map((r) => {
    const matched: string[] = [];
    const negated: string[] = [];
    /**
     * Terms the CV mentions BOTH affirmatively and inside a qualifying clause
     * — "used Supabase for auth" alongside "I'm less experienced with
     * Supabase". `negated` only fills when EVERY mention is negated, so this
     * mixed case slipped through as a clean match and the row went out as Met
     * (audit #4, M6).
     */
    const qualified: string[] = [];
    const localEvidence: EvidenceRef[] = [];
    for (const kw of r.keywords) {
      const k = kw.toLowerCase();
      // Route the term through the synonym table ("k8s" is evidence for
      // "kubernetes"; "java" and "javascript" stay disjoint), then add safe
      // inflections of every surface form so "workflows" satisfies
      // "workflow" without any general stemming step.
      const surfaceForms = (() => {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const base of expandTerm(k)) {
          for (const form of [base, ...inflectionVariants(base)]) {
            if (!seen.has(form)) {
              seen.add(form);
              out.push(form);
            }
          }
        }
        return out;
      })();
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
      if (hits.length === 0) {
        // Not in the CV — check the screening answers before giving up.
        //
        // The negation test used to run on the CV path ONLY. A term found in a
        // screening answer was pushed straight into `matched`, so
        // "I'm less experienced with React/Supabase" — the exact sentence
        // engine-version.ts names as a self-deprecating qualifier under
        // v1.5.1 — credited Supabase as Met. The cue list was right and the
        // window logic was right; neither was ever asked about this corpus
        // (audit 1 Sep, F3). Screening answers are where a candidate is most
        // likely to qualify a claim, which makes this the corpus that needed
        // it most.
        let found = false;
        for (const sc of screeningCorpus) {
          for (const form of surfaceForms) {
            const scHits = findTermMatches(sc.text, form, cal.max_term_hits);
            if (scHits.length === 0) continue;
            const affirmativeInAnswer = scHits.filter(
              (at) => !isNegatedMention(sc.text, at, cal),
            );
            const snippet = cleanQuote(sc.text) || sc.text.slice(0, 200);
            const ref: EvidenceRef = {
              requirement_id: r.id,
              requirement_text: r.text,
              source: "screening",
              matched_terms: [kw],
              snippet,
              location: `screening:${sc.question_id}`,
            };
            // Same rule as the CV: every mention negated means the answer
            // denies the requirement rather than evidencing it. The passage is
            // still recorded so a reviewer can see what was read.
            if (affirmativeInAnswer.length === 0) negated.push(kw);
            else matched.push(kw);
            localEvidence.push(ref);
            found = true;
            break;
          }
          if (found) break;
        }
        continue;
      }
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
      // Some mentions affirm and some qualify. The match is real, but so is
      // what the candidate said about their own level of it.
      if (affirmative.length < hits.length) qualified.push(kw);
      // ...and what they said about it in a screening ANSWER counts the same.
      //
      // v1.5.3 added the negation test to the screening path, but only inside
      // the `hits.length === 0` fallback — the branch for "the CV had nothing".
      // So the guard reached the candidate whose CV was silent and missed the
      // one whose CV lists the skill and whose screening answer then walks it
      // back. That is the more common shape of the two, and it produced the
      // same clean Met: the qualifying sentence was never read at all
      // (audit 1 Sep rev 16, F3).
      //
      // A candidate qualifying their own claim is the most direct evidence
      // there is about their level, whichever field they typed it into.
      for (const sc of screeningCorpus) {
        let qualifiedHere = false;
        for (const form of surfaceForms) {
          const scHits = findTermMatches(sc.text, form, cal.max_term_hits);
          if (scHits.length === 0) continue;
          if (scHits.every((at) => isNegatedMention(sc.text, at, cal))) {
            qualified.push(kw);
            localEvidence.push({
              requirement_id: r.id,
              requirement_text: r.text,
              source: "screening",
              matched_terms: [kw],
              snippet: cleanQuote(sc.text) || sc.text.slice(0, 200),
              location: `screening:${sc.question_id}`,
            });
            qualifiedHere = true;
          }
          break;
        }
        if (qualifiedHere) break;
      }
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
    // An alternatives list — "Cloudflare, Netlify, or Vercel", every keyword a
    // proper noun joined by or/ou — is satisfied by ANY one of them. The ratio
    // formula below would demand all three, which no candidate can pass and no
    // client intended. Restricted to capitalised alternatives so "React or a
    // similar frontend framework" keeps its normal threshold.
    const isAlternativesList =
      r.keywords.length >= 2 &&
      /\b(or|ou)\b/i.test(r.text) &&
      r.keywords.every((kw) =>
        new RegExp(`(^|[^A-Za-z0-9])${escapeRe(kw[0]!.toUpperCase() + kw.slice(1))}`).test(r.text),
      );

    // Keywords the requirement names as a specific product/tool: capitalised
    // mid-sentence in the requirement text (Lovable, Cloudflare, Supabase).
    // Sentence-initial words are excluded — they are capitalised by grammar.
    // Capitalised MID-SENTENCE: grammar cannot explain it, so it names a thing.
    const midSentenceProducts = r.keywords.filter((kw) => {
      const capitalised = kw[0]!.toUpperCase() + kw.slice(1);
      return new RegExp(`[^.!?]\\s${escapeRe(capitalised)}\\b`).test(r.text);
    });

    // Capitalised only because it starts the sentence. `^` was added to the
    // pattern so a product written FIRST ("React and Kubernetes and Terraform")
    // was visible to the gate — correct, but it also swept up ordinary words
    // that happen to open a requirement, and the gate can REJECT. "Owns
    // features end to end, from schema design to shipped UI" made `Owns` a
    // named product, so a CV saying "I own features end to end" matched six of
    // the seven terms and was still hard-MISSING, because it never contained
    // the literal word "Owns". Same for "Exposure to AI ...". A client writes
    // requirements as sentences; every one of them starts with a capital.
    //
    // A first word is only a product name when the requirement names another
    // one mid-sentence — which is exactly the "React and Kubernetes" case the
    // `^` was added for, and never the case for a sentence that simply begins
    // with a verb.
    const sentenceInitial = r.keywords.filter((kw) => {
      const capitalised = kw[0]!.toUpperCase() + kw.slice(1);
      return (
        !midSentenceProducts.includes(kw) &&
        new RegExp(`^${escapeRe(capitalised)}\\b`).test(r.text)
      );
    });

    const namedProducts =
      midSentenceProducts.length > 0
        ? [...midSentenceProducts, ...sentenceInitial]
        : midSentenceProducts;

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
      isAlternativesList ||
      matched.length >=
        // The floor can never exceed the number of terms the requirement
        // actually has, otherwise a single-term requirement ("HACCP") could
        // only ever reach "partial" no matter how clearly the CV evidences it.
        Math.min(
          r.keywords.length,
          Math.max(cal.met_keyword_floor, Math.ceil(r.keywords.length * cal.met_keyword_ratio)),
        )
    ) {
      status = "met";
    } else {
      status = "partial";
    }

    // Named-product gate, both directions (audit #4, H5).
    //
    // "Experience with Lovable" came back MET quoting AWS and Kibana on a CV
    // where the word Lovable never appears: when a requirement names specific
    // products, one of those names must actually be present, because generic
    // overlap is not evidence of a named tool.
    //
    // The converse matters just as much: naming the product IS the evidence,
    // whatever the surrounding prose ("or a similar AI app builder") does to
    // the keyword ratio.
    if (namedProducts.length > 0 && matched.length > 0) {
      const namedHit = namedProducts.some((p) =>
        matched.some((kw) => kw.toLowerCase() === p.toLowerCase()),
      );
      if (namedHit) {
        // Naming the product IS the evidence — but only when the requirement
        // names ONE. "React and Kubernetes and Terraform" asks for three, and
        // matching one of them is a partial answer, not a complete one; an
        // alternatives list ("Cloudflare, Netlify, or Vercel") is already
        // promoted above by isAlternativesList, which is the case this
        // promotion was written for.
        if (namedProducts.length === 1) status = "met";
      } else {
        // The gate only demoted MET, so a requirement that never reached met
        // in the first place sailed through: "Experience with Lovable for
        // rapid website and application development" came back PARTIAL on the
        // framing words "application" and "development", quoting MongoDB,
        // Express and Jenkins — passages with nothing to do with Lovable
        // (audit 1 Sep, F4).
        //
        // Generic overlap is not evidence of a named tool at ANY status. If
        // the CV is thin the honest answer is "we could not tell"; otherwise
        // the product is simply absent.
        status = cvIsThin ? "unknown" : "missing";
        needs_validation = true;
      }
    }

    // A qualifying statement alongside a positive match. Negation used to be
    // consulted ONLY when EVERY mention was negated, so "I'm less experienced
    // with React/Supabase" was discarded the moment Supabase also appeared
    // somewhere positive — and the row went out as Met (audit #4, M6). The
    // candidate said something qualifying about this requirement; that caps
    // the row and asks for a human.
    if ((qualified.length > 0 || negated.length > 0) && matched.length > 0 && status === "met") {
      status = "partial";
      needs_validation = true;
    }

    // No quote, no claim. A Met or Partial row with nothing to show is a
    // keyword hit a client cannot check — the audit found "English · Met" with
    // no passage behind it at all (audit #4, M6). The term match is real, so
    // this is not "missing"; it is unverified, and says so.
    const quotes = localEvidence.slice(0, cal.max_evidence_per_requirement);
    if (quotes.length === 0 && (status === "met" || status === "partial")) {
      status = "unknown";
      needs_validation = true;
    }

    evidence.push(...quotes);
    return {
      id: r.id,
      text: r.text,
      required: r.required,
      status,
      matched_terms: matched,
      evidence: quotes,
      needs_validation,
    };
  });

  // Evidence substance: does anything sit AROUND the matched terms? A CV that
  // just repeats the rubric's keywords matches every term and evidences nothing,
  // so its "met" statuses are demoted to "partial" needing validation and the
  // composite is capped below the top bands further down.
  const substance = measureSubstance({
    cv_text: cv,
    evidence,
    matched_terms: assessment.flatMap((a) => a.matched_terms),
    calibration: cal,
  });
  if (substance.verdict === "keyword_echo") {
    for (const a of assessment) {
      if (a.status === "met") {
        a.status = "partial";
        a.needs_validation = true;
      }
    }
  }

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

  // Linked screening answers (v1.5.0). An answer and a requirement are linked
  // when they share at least two content words — one shared word is
  // coincidence, not subject. A linked affirmative then means two different
  // things depending on what the CV said:
  //
  //   - CV silent (missing/unknown): the answer is weak POSITIVE evidence.
  //     The requirement is floored at "partial", flagged for validation, and
  //     the answer is recorded as its evidence. Self-attestation never
  //     reaches "met" on its own.
  //   - CV affirmatively NEGATES the claim (status "contradicted"): that is a
  //     real screening/CV contradiction, recorded pair by pair.
  //
  // v1.4.1 flagged the silent case as a contradiction, which punished the
  // candidate for the CV not repeating their answer. Absence of corroboration
  // is a thing to verify, not a conflict.
  const contradiction_rows: ScoringResult["contradiction_rows"] = [];
  if (!disqualified) {
    const meaningful = (text: string) =>
      tokenize(text).filter((t) => t.length >= 4 && !REQUIREMENT_FRAMING.has(t));
    for (const s of input.screening) {
      if (s.answer_type !== "boolean" || normalizeScreeningValue(s) !== "yes") continue;
      const qTokens = new Set(meaningful(s.question ?? ""));
      if (qTokens.size === 0) continue;
      for (const a of assessment) {
        if (!a.required) continue;
        const overlap = new Set(meaningful(a.text).filter((t) => qTokens.has(t)));
        if (overlap.size < 2) continue;
        if (a.status === "missing" || a.status === "unknown") {
          a.status = "partial";
          a.needs_validation = true;
          const ref: EvidenceRef = {
            requirement_id: a.id,
            requirement_text: a.text,
            source: "screening",
            matched_terms: [...overlap],
            snippet: `Answered yes to: "${s.question}"`,
            location: `screening:${s.question_id}`,
          };
          a.evidence.push(ref);
          evidence.push(ref);
        } else if (a.status === "contradicted") {
          contradiction_rows.push({
            question_id: s.question_id,
            question: s.question,
            requirement: a.text,
          });
        }
      }
    }
  }
  let contradiction_status: ScoringResult["contradiction_status"] = "none";
  if (disqualified) contradiction_status = "disqualifying_answer";
  else if (contradiction_rows.length > 0) contradiction_status = "screening_contradicts_cv";

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

  // 4) Keyword echo: the terms are present but nothing around them is. This is
  //    the gameability cap — a keyword list cannot reach better than mid
  //    "Consider" no matter how complete its term coverage looks.
  if (substance.verdict === "keyword_echo") {
    applyCap(`keyword_echo: ${substance.reason}`, cal.keyword_echo_cap);
  }
  // 5) Thin substance or shallow evidence: a real but slight document. Capped at
  //    the top of "Consider" rather than demoted, because the candidate may well
  //    fit — we just have not read enough to say so.
  else if (substance.verdict === "thin") {
    applyCap(`thin_evidence: ${substance.reason}`, cal.thin_substance_cap);
  }

  const score = Math.round(score01 * 1000) / 10; // 0.0-100.0


  // Confidence: based on evidence volume, CV length, and screening completeness.
  const cw = cal.confidence_weights;
  const cvTokenBoost = Math.min(
    Math.min(1, cv.length / cal.confidence_cv_length_target),
    substance.substance_ratio,
  );
  // Volume alone was gameable: one sentence quoted per requirement counted as
  // full evidence. Breadth (distinct passages) and depth (context words around
  // each term) now scale it, so a keyword list cannot report high completeness.
  const evidenceBoost =
    Math.min(
      1,
      substance.evidence_passages /
        Math.max(cal.confidence_evidence_floor, requirements.length),
    ) * Math.max(substance.depth_ratio, 0);
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

  const strengths: string[] = deriveStrengths(assessment);
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
            : `Partly evidenced — worth confirming: ${a.text}`,
    );
  if (contradiction_status !== "none") {
    // Name the conflicting pair — an unexplained flag cannot be resolved.
    const named = contradiction_rows
      .slice(0, 2)
      .map((r) => `answered yes on "${r.question}" but the CV contradicts "${r.requirement}"`)
      .join("; ");
    // A raw status token used to be printed when there was no pair to name
    // ("Screening/CV contradiction (screening contradicts cv).") and an empty
    // row list produced the fragment "Screening/CV conflict: ." — both reached
    // the client's "What holds it back" verbatim (audit #4, item 12).
    concerns.unshift(
      named
        ? `Screening/CV conflict: ${named}.`
        : "A screening answer and the CV disagree. Confirm which is current before deciding.",
    );
  }
  if (cv.trim().length < cal.unreadable_cv_chars) {
    concerns.push("CV text could not be extracted with confidence.");
  }
  if (substance.reason) {
    concerns.push(
      substance.verdict === "keyword_echo"
        ? `Evidence looks like a keyword list — ${substance.reason}. Treat the term matches as unverified.`
        : `Limited detail to assess — ${substance.reason}.`,
    );
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
    contradiction_rows,
    evidence_substance: substance,
    completed_at,
    input_hash,
  };
}
