/**
 * The structured role blueprint read out of a job description.
 *
 * The intake's headline promise is "upload the job description, we build the
 * complete role blueprint". Until now the parser returned ONLY tagged
 * requirements, so a client who pasted a Senior Accountant JD still had to type
 * the title, location, compensation, employment type and seniority by hand —
 * and a client who UPLOADED a file got nothing at all, because only pasted text
 * was ever read (audit 15 Sep: INT-010, INT-013).
 *
 * This module is the contract both sides agree on. It is pure — no browser
 * globals, no server imports — so the endpoint, the intake wizard and the tests
 * all read the same field names and the same vocabularies.
 *
 * Every field is OPTIONAL and every field carries a confidence. A blueprint is
 * a suggestion, never an answer: the client sees what was read, and edits it.
 * Nothing here is written anywhere until they submit.
 */
import {
  COMP_CURRENCIES,
  COMP_PERIODS,
  MAX_REQUIREMENT_CHARS,
  MIN_REQUIREMENT_CHARS,
  REQUIREMENT_TAGS,
  WORK_MODELS,
  normalizeRequirementKey,
  type RequirementTag,
} from "@/lib/express-intake-schema";

/** How sure the reader is. Drives which fields float to the top for review. */
export const BLUEPRINT_CONFIDENCE = ["high", "medium", "low"] as const;
export type BlueprintConfidence = (typeof BLUEPRINT_CONFIDENCE)[number];

/** Seniority vocabulary, matching what the role editor and publish gate use. */
export const BLUEPRINT_SENIORITY = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "director",
  "executive",
] as const;
export type BlueprintSeniority = (typeof BLUEPRINT_SENIORITY)[number];

export const BLUEPRINT_EMPLOYMENT = [
  "full_time",
  "part_time",
  "contract",
  "temporary",
  "internship",
] as const;
export type BlueprintEmployment = (typeof BLUEPRINT_EMPLOYMENT)[number];

/** One read field: the value, and how sure the reader was. */
export type BlueprintField<T> = { value: T; confidence: BlueprintConfidence };

export type JdBlueprint = {
  title?: BlueprintField<string>;
  seniority?: BlueprintField<BlueprintSeniority>;
  location?: BlueprintField<string>;
  workModel?: BlueprintField<(typeof WORK_MODELS)[number]>;
  employmentType?: BlueprintField<BlueprintEmployment>;
  salaryMin?: BlueprintField<number>;
  salaryMax?: BlueprintField<number>;
  currency?: BlueprintField<string>;
  compensationPeriod?: BlueprintField<string>;
  team?: BlueprintField<string>;
  reportingLine?: BlueprintField<string>;
  targetStartDate?: BlueprintField<string>;
  /**
   * True when the description itself says the role cannot sponsor a visa, or
   * requires existing work authorisation. Lets the wizard answer the visa
   * question from the text instead of asking it twice (INT-015).
   */
  requiresExistingWorkAuth?: BlueprintField<boolean>;
  screeningQuestions?: BlueprintField<string[]>;
};

/** Requirements keep their existing shape — that part was already accurate. */
export type BlueprintRequirement = { text: string; tag: RequirementTag };

export type JdBlueprintResult = {
  blueprint: JdBlueprint;
  requirements: BlueprintRequirement[];
};

/* ------------------------------------------------------------- cleaning -- */

const isOneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === "string" && (list as readonly string[]).includes(v);

function confidenceOf(raw: unknown): BlueprintConfidence {
  return isOneOf(BLUEPRINT_CONFIDENCE, raw) ? raw : "low";
}

/**
 * Reads one field out of the model's reply.
 *
 * A model will happily return "" or "not stated" or "unknown" for a field it
 * could not find. Those are not values — treating them as ones would overwrite
 * a real answer with a placeholder, so they are dropped here rather than
 * downstream.
 */
function field<T>(raw: unknown, coerce: (v: unknown) => T | null): BlueprintField<T> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const value = coerce(r["value"]);
  if (value === null) return undefined;
  return { value, confidence: confidenceOf(r["confidence"]) };
}

const NOT_STATED = /^(not stated|unknown|n\/?a|none|null|undefined|-+)$/i;

function asText(max: number) {
  return (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (!s || NOT_STATED.test(s) || s.length > max) return null;
    return s;
  };
}

function asNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  // A salary of 0 is not a salary, and anything past eight figures is a parse
  // artefact (a phone number, a postcode, a year run together).
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) return null;
  return Math.round(n);
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function asStringList(max: number) {
  return (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    const out = v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 2 && x.length <= max)
      .slice(0, 8);
    return out.length ? out : null;
  };
}

/** An ISO date the wizard's date input can hold, or nothing. */
function asIsoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? s : null;
}

const MAX_SUGGESTIONS = 12;

/** Keeps only well-formed, de-duplicated, length-legal requirements. */
export function cleanRequirements(raw: unknown): BlueprintRequirement[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: BlueprintRequirement[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const text = String((entry as Record<string, unknown>)["text"] ?? "")
      .replace(/^[-•*\s]+/, "")
      .trim();
    const tag = (entry as Record<string, unknown>)["tag"];
    if (text.length < MIN_REQUIREMENT_CHARS || text.length > MAX_REQUIREMENT_CHARS) continue;
    if (!isOneOf(REQUIREMENT_TAGS, tag)) continue;
    const key = normalizeRequirementKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, tag: tag as RequirementTag });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Turns the model's raw reply into a blueprint we are willing to show.
 *
 * Anything unrecognised is dropped rather than guessed at. A missing field is
 * a field the client fills in themselves — which is exactly what happens today
 * — so dropping is always safe, and inventing never is.
 */
export function cleanBlueprint(raw: unknown): JdBlueprint {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;

  const salaryMin = field(r["salaryMin"], asNumber);
  const salaryMax = field(r["salaryMax"], asNumber);

  const out: JdBlueprint = {
    title: field(r["title"], asText(160)),
    seniority: field(r["seniority"], (v) => (isOneOf(BLUEPRINT_SENIORITY, v) ? v : null)),
    location: field(r["location"], asText(160)),
    workModel: field(r["workModel"], (v) => (isOneOf(WORK_MODELS, v) ? v : null)),
    employmentType: field(r["employmentType"], (v) => (isOneOf(BLUEPRINT_EMPLOYMENT, v) ? v : null)),
    salaryMin,
    salaryMax,
    currency: field(r["currency"], (v) =>
      isOneOf(COMP_CURRENCIES, typeof v === "string" ? v.toUpperCase() : v)
        ? String(v).toUpperCase()
        : null,
    ),
    compensationPeriod: field(r["compensationPeriod"], (v) =>
      isOneOf(COMP_PERIODS, v) ? v : null,
    ),
    team: field(r["team"], asText(120)),
    reportingLine: field(r["reportingLine"], asText(120)),
    targetStartDate: field(r["targetStartDate"], asIsoDate),
    requiresExistingWorkAuth: field(r["requiresExistingWorkAuth"], asBool),
    screeningQuestions: field(r["screeningQuestions"], asStringList(240)),
  };

  // A range that runs backwards is a misread, not a range. Drop both rather
  // than show the client a minimum above the maximum.
  if (salaryMin && salaryMax && salaryMin.value > salaryMax.value) {
    delete out.salaryMin;
    delete out.salaryMax;
  }

  for (const k of Object.keys(out) as (keyof JdBlueprint)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}

/** Field keys a blueprint can fill, in the order the review screen shows them. */
export const BLUEPRINT_FIELD_ORDER: (keyof JdBlueprint)[] = [
  "title",
  "seniority",
  "location",
  "workModel",
  "employmentType",
  "salaryMin",
  "salaryMax",
  "currency",
  "compensationPeriod",
  "team",
  "reportingLine",
  "targetStartDate",
  "requiresExistingWorkAuth",
  "screeningQuestions",
];

/** How many fields the reader actually filled. Drives the "we read N fields" line. */
export function blueprintFieldCount(b: JdBlueprint): number {
  return BLUEPRINT_FIELD_ORDER.filter((k) => b[k] !== undefined).length;
}
