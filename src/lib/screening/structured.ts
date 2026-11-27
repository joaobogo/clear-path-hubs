/**
 * Structured screening (pilot, 27 Nov 2026).
 *
 * A job with positions.structured_screening_enabled asks short, structured
 * questions built from its must-haves instead of its standard screening
 * questions. The questions live in structured_screening_questions and the
 * answers in structured_screening_answers, two tables nothing else reads, so
 * every other job, and the standard questions and answers on these jobs, stay
 * exactly as they are. Switching the flag off brings the standard form back;
 * answers already given are kept.
 *
 * What an answer does:
 *   - A question with a pass rule checks one must-have. A pass gives that
 *     must-have full credit in the score; where the CV does not show it, the
 *     reviewer is asked to verify it. A fail raises a flag naming the
 *     question. Nobody is rejected or capped by a pilot answer.
 *   - A question without a pass rule (start date, pay, the one-line deal
 *     description) is for the reviewer only and never moves the score.
 *   - A question that was never asked (everyone who applied before the switch
 *     was turned on) is neutral: no flag, no credit, no penalty.
 *
 * Pure: shared by the apply form, the server that stores answers, the scorer,
 * the admin view and the application alert.
 */

export const STRUCTURED_QUESTION_TYPES = [
  "yes_no",
  "single_select",
  "multi_select",
  "short_text",
  "url",
  "number_range",
] as const;
export type StructuredQuestionType = (typeof STRUCTURED_QUESTION_TYPES)[number];

export const STRUCTURED_SECTIONS = ["about_you", "this_role"] as const;
export type StructuredSection = (typeof STRUCTURED_SECTIONS)[number];

export const STRUCTURED_SECTION_TITLES: Record<StructuredSection, string> = {
  about_you: "About you",
  this_role: "About this role",
};

/** One-line answers are kept short: one line on a phone, never an essay. */
export const STRUCTURED_TEXT_MAX = 150;

/**
 * The consent sentence added to a job with structured screening.
 */
export const STRUCTURED_CONSENT_TEXT =
  "The information I've given is accurate, and TaaSFlow may verify it before introducing me to the employer.";

/**
 * Questions answered by a field the form already has: the LinkedIn link and
 * the city and country. The form asks them once, in "About you", and the
 * server stores them as answers.
 */
export const FORM_FIELD_KEYS = ["linkedin_url", "based_in"] as const;

export type PassRule =
  | { equals: boolean | string; verify_with_cv?: boolean }
  | { in: string[]; verify_with_cv?: boolean }
  | { min_count: number; exclude?: string[]; verify_with_cv?: boolean };

export interface StructuredQuestion {
  key: string;
  label: string;
  type: StructuredQuestionType;
  options: string[] | null;
  required: boolean;
  section: StructuredSection;
  /** The must-have this question checks, word for word as the role states it. */
  maps_to_requirement: string | null;
  pass_rule: PassRule | null;
  sort_order: number;
  /** Shown under the question, e.g. "Up to two names". */
  help: string | null;
  /** number_range only, e.g. "GBP per year". */
  unit: string | null;
  /** Show only when another question has this answer. */
  show_when: { key: string; equals: boolean | string } | null;
  /** A short name for the admin view and the alert line, e.g. "Largest deal". */
  short_label: string | null;
  /** Staff only: never shown to the client (pay expectation). */
  staff_only: boolean;
}

export type StructuredValue = boolean | string | string[] | { min: number; max: number };

export interface StructuredAnswer {
  key: string;
  value: StructuredValue | null;
  status: "answered" | "not_asked" | "skipped";
  source: "candidate" | "cv_linkedin" | "recruiter";
}

export interface StructuredScreening {
  enabled: boolean;
  enabled_at: string | null;
  questions: StructuredQuestion[];
}

// ---------------------------------------------------------------------------
// Reading rows

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** A stored question row as the pure type. Unknown types or sections are dropped. */
export function questionFromRow(row: Record<string, unknown>): StructuredQuestion | null {
  const type = row.type as StructuredQuestionType;
  const section = row.section as StructuredSection;
  if (!STRUCTURED_QUESTION_TYPES.includes(type) || !STRUCTURED_SECTIONS.includes(section)) {
    return null;
  }
  const key = str(row.key);
  const label = str(row.label);
  if (!key || !label) return null;
  const options = Array.isArray(row.options)
    ? (row.options as unknown[]).map((o) => String(o)).filter(Boolean)
    : null;
  const showWhen =
    row.show_when && typeof row.show_when === "object"
      ? (row.show_when as { key?: unknown; equals?: unknown })
      : null;
  return {
    key,
    label,
    type,
    options: options && options.length ? options : null,
    required: row.required === true,
    section,
    maps_to_requirement: str(row.maps_to_requirement),
    pass_rule: (row.pass_rule as PassRule | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    help: str(row.help),
    unit: str(row.unit),
    show_when:
      showWhen && typeof showWhen.key === "string"
        ? { key: showWhen.key, equals: showWhen.equals as boolean | string }
        : null,
    short_label: str(row.short_label),
    staff_only: row.staff_only === true,
  };
}

export function sortQuestions(qs: readonly StructuredQuestion[]): StructuredQuestion[] {
  const sectionOrder = (s: StructuredSection) => STRUCTURED_SECTIONS.indexOf(s);
  return [...qs].sort(
    (a, b) => sectionOrder(a.section) - sectionOrder(b.section) || a.sort_order - b.sort_order,
  );
}

// ---------------------------------------------------------------------------
// Visibility and progress

type Values = Record<string, StructuredValue | null | undefined>;

/** Whether a question is shown, given the answers so far. */
export function isShown(q: StructuredQuestion, values: Values): boolean {
  if (!q.show_when) return true;
  return values[q.show_when.key] === q.show_when.equals;
}

export function isBlank(v: StructuredValue | null | undefined): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    return !Number.isFinite((v as { min: number }).min) && !Number.isFinite((v as { max: number }).max);
  }
  return false;
}

/**
 * "7 of 11 answered": the questions always shown, counted once each. A
 * follow-up that only appears after an answer is not in the total.
 */
export function progress(
  questions: readonly StructuredQuestion[],
  values: Values,
): { answered: number; total: number } {
  const counted = questions.filter((q) => !q.show_when);
  return {
    total: counted.length,
    answered: counted.filter((q) => !isBlank(values[q.key])).length,
  };
}

// ---------------------------------------------------------------------------
// Validation (the server runs this; the form runs it to show errors early)

const URL_RE = /^https?:\/\/\S+\.\S+/;

/**
 * Check one answer against its question. Returns the value as it is stored,
 * or a plain sentence saying what to fix.
 */
export function normaliseAnswer(
  q: StructuredQuestion,
  raw: unknown,
): { ok: true; value: StructuredValue | null } | { ok: false; message: string } {
  const blank = raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0);
  if (blank) {
    return q.required
      ? { ok: false, message: `Please answer: "${q.label}"` }
      : { ok: true, value: null };
  }
  switch (q.type) {
    case "yes_no": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      const s = String(raw).trim().toLowerCase();
      if (s === "yes" || s === "true") return { ok: true, value: true };
      if (s === "no" || s === "false") return { ok: true, value: false };
      return { ok: false, message: `Choose yes or no for: "${q.label}"` };
    }
    case "single_select": {
      const s = String(raw).trim();
      if (q.options && !q.options.includes(s)) {
        return { ok: false, message: `Choose one of the options for: "${q.label}"` };
      }
      return { ok: true, value: s };
    }
    case "multi_select": {
      const list = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x).trim()).filter(Boolean);
      if (q.options && list.some((x) => !q.options!.includes(x))) {
        return { ok: false, message: `Choose from the options for: "${q.label}"` };
      }
      const unique = [...new Set(list)];
      // "None" is an answer on its own, never beside a platform.
      const none = q.options?.find((o) => /^none\b/i.test(o));
      if (none && unique.includes(none) && unique.length > 1) {
        return { ok: false, message: `"${none}" cannot be picked with other options.` };
      }
      return { ok: true, value: unique };
    }
    case "short_text": {
      const s = String(raw).replace(/\s+/g, " ").trim();
      if (s.length > STRUCTURED_TEXT_MAX) {
        return {
          ok: false,
          message: `Keep it to ${STRUCTURED_TEXT_MAX} characters for: "${q.label}"`,
        };
      }
      return { ok: true, value: s };
    }
    case "url": {
      const s = String(raw).trim();
      if (!URL_RE.test(s)) {
        return { ok: false, message: "Enter a full link starting with https://" };
      }
      return { ok: true, value: s.slice(0, 400) };
    }
    case "number_range": {
      const r = raw as { min?: unknown; max?: unknown };
      const num = (v: unknown) =>
        v === "" || v == null ? NaN : Number(String(v).replace(/[^\d.]/g, ""));
      const min = num(r?.min);
      const max = num(r?.max);
      if (!Number.isFinite(min) && !Number.isFinite(max)) {
        return q.required
          ? { ok: false, message: `Please answer: "${q.label}"` }
          : { ok: true, value: null };
      }
      const lo = Number.isFinite(min) ? min : max;
      const hi = Number.isFinite(max) ? max : min;
      if (lo < 0 || hi < 0 || lo > 100_000_000 || hi > 100_000_000) {
        return { ok: false, message: `Enter an amount for: "${q.label}"` };
      }
      return { ok: true, value: { min: Math.min(lo, hi), max: Math.max(lo, hi) } };
    }
  }
}

/**
 * Validate a whole submission. Questions answered by form fields are checked
 * by the form itself and skipped here. A follow-up that is not shown is
 * dropped even if a value was sent.
 */
export function validateAnswers(
  questions: readonly StructuredQuestion[],
  input: ReadonlyArray<{ key: string; value: unknown }>,
): { ok: true; answers: Array<{ key: string; value: StructuredValue }> } | { ok: false; message: string } {
  const byKey = new Map(input.map((a) => [a.key, a.value]));
  const values: Values = {};
  const out: Array<{ key: string; value: StructuredValue }> = [];
  for (const q of sortQuestions(questions)) {
    if ((FORM_FIELD_KEYS as readonly string[]).includes(q.key)) continue;
    if (!isShown(q, values)) continue;
    const r = normaliseAnswer(q, byKey.get(q.key));
    if (!r.ok) return r;
    values[q.key] = r.value;
    if (r.value != null) out.push({ key: q.key, value: r.value });
  }
  return { ok: true, answers: out };
}

// ---------------------------------------------------------------------------
// Pass rules

/** Whether an answer meets its question's pass rule; null when there is no rule or no answer. */
export function passes(q: StructuredQuestion, value: StructuredValue | null | undefined): boolean | null {
  const rule = q.pass_rule;
  if (!rule || value == null || isBlank(value)) return null;
  if ("equals" in rule) return value === rule.equals;
  if ("in" in rule) return typeof value === "string" && rule.in.includes(value);
  if ("min_count" in rule) {
    if (!Array.isArray(value)) return false;
    const exclude = new Set(rule.exclude ?? []);
    return value.filter((v) => !exclude.has(v)).length >= rule.min_count;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Display

const MONEY = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000).toLocaleString("en-GB")}k` : n.toLocaleString("en-GB");

/** An answer as a reader sees it. */
export function displayValue(q: StructuredQuestion, value: StructuredValue | null | undefined): string {
  if (value == null || isBlank(value)) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const { min, max } = value;
    const range = min === max ? MONEY(min) : `${MONEY(min)}–${MONEY(max)}`;
    return q.unit ? `${range} ${q.unit}` : range;
  }
  return value;
}

export function shortLabel(q: StructuredQuestion): string {
  return q.short_label ?? q.label;
}

// ---------------------------------------------------------------------------
// Flags

export type StructuredFlag =
  | { kind: "must_have"; key: string; label: string; message: string }
  | { kind: "verify"; key: string; label: string; message: string }
  | { kind: "pay"; key: string; label: string; message: string };

/**
 * Flags from the answers alone: a failed pass rule names its question. Never
 * raised for a question that was not asked.
 */
export function answerFlags(
  questions: readonly StructuredQuestion[],
  answers: readonly StructuredAnswer[],
): StructuredFlag[] {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const flags: StructuredFlag[] = [];
  for (const q of sortQuestions(questions)) {
    const a = byKey.get(q.key);
    if (!a || a.status !== "answered") continue;
    if (passes(q, a.value) === false) {
      flags.push({
        kind: "must_have",
        key: q.key,
        label: shortLabel(q),
        message: `${shortLabel(q)}: ${displayValue(q, a.value)}`,
      });
    }
  }
  return flags;
}

/**
 * Pay above the client's range, once the role has one. Pay is information
 * for the recruiter: a soft flag, never a score.
 */
export function payFlag(
  questions: readonly StructuredQuestion[],
  answers: readonly StructuredAnswer[],
  range: { min: number | null; max: number | null } | null,
): StructuredFlag | null {
  if (!range || range.max == null) return null;
  const q = questions.find((x) => x.type === "number_range");
  const a = q ? answers.find((x) => x.key === q.key && x.status === "answered") : null;
  const v = a?.value as { min: number; max: number } | undefined;
  if (!q || !v || typeof v !== "object" || !("min" in v)) return null;
  if (v.min <= range.max) return null;
  return {
    kind: "pay",
    key: q.key,
    label: shortLabel(q),
    message: `${shortLabel(q)} ${displayValue(q, v)} is above the role's range: check for flexibility`,
  };
}

/**
 * Where a pass gave a must-have its credit but the CV does not show it: the
 * reviewer verifies it before shortlisting. Read from a score run's
 * requirement rows: a row the CV alone had not met, met on the strength of a
 * pilot answer.
 */
export function verifyFlags(
  questions: readonly StructuredQuestion[],
  rows: ReadonlyArray<{
    text?: string;
    status?: string;
    needs_validation?: boolean;
    evidence?: ReadonlyArray<{ source?: string; location?: string }>;
  }>,
): StructuredFlag[] {
  const flags: StructuredFlag[] = [];
  for (const q of questions) {
    const rule = q.pass_rule as { verify_with_cv?: boolean } | null;
    if (!rule?.verify_with_cv || !q.maps_to_requirement) continue;
    const row = rows.find((r) => r.text && sameText(r.text, q.maps_to_requirement!));
    if (!row || row.status !== "met") continue;
    const ev = row.evidence ?? [];
    const fromAnswer = ev.some(
      (e) =>
        typeof e.location === "string" &&
        e.location.startsWith("screening:structured:") &&
        e.location.slice("screening:structured:".length).split("+").includes(q.key),
    );
    // The scorer marks a row it met on the strength of the answer, where the
    // CV alone had not met it, as needing validation.
    if (fromAnswer && row.needs_validation === true) {
      flags.push({
        kind: "verify",
        key: q.key,
        label: shortLabel(q),
        message: `Verify ${shortLabel(q).toLowerCase()}: the CV does not show it`,
      });
    }
  }
  return flags;
}

function sameText(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) === n(b);
}

// ---------------------------------------------------------------------------
// The scorer

/** The id a pilot answer carries inside a score run. */
export function engineQuestionId(key: string): string {
  return `structured:${key}`;
}

/**
 * The pilot answers as the scorer reads them: one yes or no per must-have
 * the questions check, linked to that must-have.
 *   - Every question checking a must-have passes: a yes that gives the
 *     must-have full credit (`decides`).
 *   - Any of them fails: a no, which counts against the screening part like
 *     any required "no", and never caps the score or rejects anyone. Two
 *     questions for one must-have (Dutch and English) must both pass.
 *   - A question with a pass rule but no must-have (right to work) is a yes or
 *     no of its own, for the screening part only.
 * Questions without a pass rule are for the reviewer only.
 */
export interface EngineStructuredAnswer {
  question_id: string;
  question: string;
  required: boolean;
  answer_type: "boolean";
  value: boolean;
  must_have: string | null;
  decides: true;
  answer_label: string;
}

export function toEngineAnswers(
  questions: readonly StructuredQuestion[],
  answers: readonly StructuredAnswer[],
): EngineStructuredAnswer[] {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const groups = new Map<string, Array<{ q: StructuredQuestion; pass: boolean; label: string }>>();
  for (const q of sortQuestions(questions)) {
    const a = byKey.get(q.key);
    if (!a || a.status !== "answered") continue;
    const pass = passes(q, a.value);
    if (pass == null) continue;
    const group = q.maps_to_requirement ? `req:${q.maps_to_requirement}` : `q:${q.key}`;
    const list = groups.get(group) ?? [];
    list.push({ q, pass, label: `${shortLabel(q)}: ${displayValue(q, a.value)}` });
    groups.set(group, list);
  }
  const out: EngineStructuredAnswer[] = [];
  for (const list of groups.values()) {
    out.push({
      question_id: engineQuestionId(list.map((x) => x.q.key).join("+")),
      question: list.map((x) => x.q.label).join(" / "),
      required: true,
      answer_type: "boolean",
      value: list.every((x) => x.pass),
      must_have: list[0].q.maps_to_requirement,
      decides: true,
      answer_label: list.map((x) => x.label).join("; "),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The one-line summary for the alert and the top of the admin view

/**
 * "Largest deal: $2-5M (data migration, Dutch bank) | Dutch: Professional |
 * KvK: Yes | Flags: none". The questions in their order, the deal's one-line
 * description in brackets after its size, follow-ups after their question.
 * Pay is left out: staff see it on the candidate page.
 */
export function summaryLine(
  questions: readonly StructuredQuestion[],
  answers: readonly StructuredAnswer[],
  flags: readonly StructuredFlag[],
): string {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const parts: string[] = [];
  const attached = new Set<string>();
  const sorted = sortQuestions(questions).filter((q) => q.section === "this_role" || q.key === "work_auth");
  for (const q of sorted) {
    if (attached.has(q.key)) continue;
    const a = byKey.get(q.key);
    if (!a || a.status !== "answered" || isBlank(a.value)) continue;
    // A one-line description belongs to the question before it.
    const detail = sorted.find(
      (x) => x !== q && x.type === "short_text" && (x.key === `${q.key}_what` || x.show_when?.key === q.key),
    );
    let text = `${shortLabel(q)}: ${displayValue(q, a.value)}`;
    if (detail) {
      attached.add(detail.key);
      const d = byKey.get(detail.key);
      if (d && d.status === "answered" && !isBlank(d.value)) text += ` (${displayValue(detail, d.value)})`;
    }
    parts.push(text);
  }
  parts.push(`Flags: ${flags.length ? flags.map((f) => f.label).join(", ") : "none"}`);
  return parts.join(" | ");
}
