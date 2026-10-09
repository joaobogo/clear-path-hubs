/**
 * The role as ONE record, from the intake form to the edit screen and back.
 *
 * The owner's report (8 Oct): "it kept saying I didn't put the time zone or
 * city, but I actually did in the intake form. The same information in the
 * intake form should be the one in the editing role area."
 *
 * Root cause: three hand-written mappings disagreed.
 *  - The intake handler wrote remote time-zone bands, "anywhere in the
 *    country", on-site days, sponsorship, interview stages, decision maker,
 *    bonus/equity and trainable requirements into places the edit screen never
 *    read, so the editor opened with those answers blank.
 *  - The edit screen asked for location only as STRUCTURED rows
 *    (position_locations, country + city), which the intake never creates. The
 *    intake's "Manchester, United Kingdom" was stuffed into a "notes" box with
 *    no country, and the save refused it ("Choose a country", "add a city or
 *    region") — while the quality checklist said "At least one location" and
 *    "Timezone anchor or overlap" were missing.
 *  - The editor's save schema was stricter than the intake: work model,
 *    seniority, employment type and headcount were required, a must-have could
 *    be at most 80 characters (the intake allows 120), the description 20,000
 *    (the intake allows 60,000), and "3 must-haves" (the intake asks for one).
 *    An untouched intake role could fail its first save.
 *
 * This module is the single, pure definition of each direction:
 *  - intakePayloadToPosition()  intake answers  → positions row
 *  - positionToEditForm()       positions row   → edit form
 *  - editFormToPositionPatch()  edit form       → positions patch
 *  - roleRequiredness()         what the edit screen and the save handler
 *                               may refuse (only what sourcing cannot start
 *                               without); everything else is a hint.
 *
 * It reads and writes nothing, so it is unit-testable end to end.
 */
import { z } from "zod";
import {
  COMP_EQUITY,
  INTERVIEW_STAGE_FORMATS,
  MAX_INTERVIEW_STAGES,
  MAX_TARGET_DAYS_TO_OFFER,
  MIN_MUST_HAVES,
  MIN_TARGET_DAYS_TO_OFFER,
  TIMEZONE_BAND_VALUES,
  WORK_AUTHORIZATION_VALUES,
  briefCompleteness,
  collaboratorCandidates,
  interviewProcessSummary,
  isValidOwnerEmail,
  splitLines,
  type InterviewStage,
  type InterviewStageFormat,
  type RequirementTag,
} from "@/lib/express-intake-schema";
import { normalizeDealBreakers } from "@/lib/client-deal-breakers";
import { normalizeSeniority } from "@/lib/position-seniority";
import { positionField } from "@/lib/positions/field-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/* ------------------------------------------------------------------ */
/* Small value helpers                                                 */
/* ------------------------------------------------------------------ */

const obj = (v: unknown): Record<string, AnyRow> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, AnyRow>) : {};

export function asStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function asStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Labels out of a list of strings or `{ label }` objects. */
export function fromJsonArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object" && "label" in (x as AnyRow)
          ? String((x as AnyRow).label ?? "")
          : "",
    )
    .filter(Boolean);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = asStr(value).trim();
    if (text) return text;
  }
  return "";
}

function firstList(...values: unknown[]): string[] {
  for (const value of values) {
    const list = fromJsonArray(value);
    if (list.length > 0) return list;
  }
  return [];
}

/**
 * A calendar date the `date` column accepts, or null.
 *
 * The intake's date input sends ISO, but the description parser can prefill
 * "As soon as possible" — which the Postgres `date` column rejects, failing
 * the whole submission. Prose is kept as a note instead.
 */
export function isoDateOrNull(raw: unknown): string | null {
  const v = asStr(raw).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const TIMEZONE_BANDS = new Set<string>(TIMEZONE_BAND_VALUES);
const EQUITY = new Set<string>(COMP_EQUITY);
const AUTH_RULES = new Set<string>(WORK_AUTHORIZATION_VALUES);
const STAGE_FORMATS = new Set<string>(INTERVIEW_STAGE_FORMATS);

function wholeNumberIn(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : Number(asStr(raw).trim());
  if (asStr(raw).trim() === "" && typeof raw !== "number") return null;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/* ------------------------------------------------------------------ */
/* Registry limits — loaded values are fitted, never rejected          */
/* ------------------------------------------------------------------ */

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s: AnyRow = schema;
  while (s && (s._def?.innerType || s._def?.schema)) s = s._def.innerType ?? s._def.schema;
  return s as z.ZodTypeAny;
}

function maxOf(schema: z.ZodTypeAny | undefined): number | null {
  if (!schema) return null;
  const s: AnyRow = unwrap(schema);
  const check = (s?._def?.checks ?? []).find((c: AnyRow) => c.kind === "max");
  return typeof check?.value === "number" ? check.value : null;
}

/**
 * Fit a value loaded from the database to the field's own limits.
 *
 * Generated briefs carry prose longer than the editor's fields allow (a
 * hiring timeline sentence in an 80-character box). Opening and saving the
 * role without touching that field used to fail validation on it. A loaded
 * value is now fitted to the box it is shown in.
 */
export function fitToField(name: string, value: unknown): unknown {
  let field;
  try {
    field = positionField(name);
  } catch {
    return value;
  }
  const s: AnyRow = unwrap(field.schema);
  if (typeof value === "string") {
    const max = maxOf(field.schema);
    return max !== null && value.length > max ? value.slice(0, max) : value;
  }
  if (Array.isArray(value) && s?._def?.typeName === "ZodArray") {
    const maxItems = s._def.maxLength?.value ?? null;
    const itemMax = maxOf(s._def.type);
    let out = value.filter((v) => typeof v === "string" && v.trim().length > 0) as string[];
    if (itemMax !== null) out = out.map((v) => (v.length > itemMax ? v.slice(0, itemMax) : v));
    if (typeof maxItems === "number") out = out.slice(0, maxItems);
    return out;
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* The edit form                                                       */
/* ------------------------------------------------------------------ */

export type ScreeningInput = {
  id?: string;
  question: string;
  answer_type: "text" | "boolean" | "number";
  required: boolean;
  dealbreaker: boolean;
  /** The must-have on the brief this question tests. */
  must_have: string;
  /** One line the candidate reads explaining why it is asked. */
  why_asked: string;
};

export type RoleStage = {
  name: string;
  format: InterviewStageFormat;
  ownerName: string;
  ownerEmail: string;
};

/**
 * The answers the intake asks that the editor did not show before. Same
 * names as the intake fields, in the position's snake_case.
 */
export type RoleIntakeAnswers = {
  remote_timezones: string[];
  remote_anywhere_in_country: boolean;
  onsite_days: number | "";
  sponsorship_available: "" | "yes" | "no";
  work_authorization_rule: "" | (typeof WORK_AUTHORIZATION_VALUES)[number];
  work_authorization_rule_note: string;
  compensation_undecided: boolean;
  compensation_flexible: boolean;
  bonus_structure: string;
  equity: "" | (typeof COMP_EQUITY)[number];
  trainable_skills: string[];
  interview_stages: RoleStage[];
  decision_maker: string;
  decision_maker_email: string;
};

export type PositionEditInitial = RoleIntakeAnswers & {
  id: string;
  organization_id: string;
  organization_name: string;
  status: string;
  visibility: string;

  // The role
  title: string;
  department: string;
  location: string;
  work_model: "" | "remote" | "hybrid" | "onsite";
  employment_type: "" | "full_time" | "part_time" | "contract" | "temporary" | "internship";
  seniority: string;
  headcount: number | "";
  description: string;
  open_worldwide: boolean;
  target_countries: string[];
  states_regions: string[];
  metro_areas: string[];
  search_radius: string;
  hiring_urgency: string;
  target_start_date: string;
  time_to_hire: string;

  // Who you need
  must_have_skills: string[];
  nice_to_have_skills: string[];
  certifications_list: string[];
  tools_platforms: string[];
  experience: string;
  education: string;
  timezone_requirements: string;
  responsibilities: string;
  additional_requirements: string;

  // Compensation
  currency: string;
  budget_period: string;
  budget_min: string;
  budget_max: string;
  compensation: string;

  // Search criteria and process
  target_titles: string[];
  title_match_timing: "" | "current" | "previous" | "either";
  target_company_types: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  disqualifier_tags: string[];
  interview_process: string;
  additional_context: string;
  screening_questions: ScreeningInput[];

  // Job post personalisation (stored in intake_context.posting)
  company_intro: string;
  benefits: string;
  languages: string;
  travel: string;
  work_authorization_note: string;
  accessibility_note: string;
  eeo_statement: string;
  brand_tone: string;
  application_deadline: string;
  confidentiality: string;
};

/** Zod shape for the intake answers, spread into the save validator. */
export const roleIntakeAnswersShape = {
  // Unknown legacy values are dropped on read, so only real bands arrive here.
  remote_timezones: z.array(z.enum(TIMEZONE_BAND_VALUES)).max(8).default([]),
  remote_anywhere_in_country: z.boolean().default(false),
  onsite_days: z.union([z.number().int().min(0).max(7), z.literal("")]).default(""),
  sponsorship_available: z.enum(["", "yes", "no"]).default(""),
  work_authorization_rule: z
    .enum(["", ...WORK_AUTHORIZATION_VALUES] as unknown as [string, ...string[]])
    .default(""),
  work_authorization_rule_note: z.string().trim().max(1000).default(""),
  compensation_undecided: z.boolean().default(false),
  compensation_flexible: z.boolean().default(false),
  bonus_structure: z.string().trim().max(500).default(""),
  equity: z.enum(["", ...COMP_EQUITY] as unknown as [string, ...string[]]).default(""),
  trainable_skills: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  interview_stages: z
    .array(
      z.object({
        name: z.string().trim().max(60).default(""),
        format: z.enum(INTERVIEW_STAGE_FORMATS).default("video_call"),
        ownerName: z.string().trim().max(120).default(""),
        ownerEmail: z.string().trim().max(255).default(""),
      }),
    )
    .max(MAX_INTERVIEW_STAGES)
    .default([]),
  decision_maker: z.string().trim().max(160).default(""),
  decision_maker_email: z.string().trim().max(255).default(""),
  /** True when the client typed a new location in the edit screen. */
  location_changed: z.boolean().default(false),
} satisfies z.ZodRawShape;

/* ------------------------------------------------------------------ */
/* positions row → edit form                                           */
/* ------------------------------------------------------------------ */

function preferredByKind(rows: unknown): { nice: string[]; trainable: string[] } {
  const list = Array.isArray(rows) ? rows : [];
  const nice: string[] = [];
  const trainable: string[] = [];
  for (const r of list) {
    const label = typeof r === "string" ? r : asStr((r as AnyRow)?.label);
    if (!label.trim()) continue;
    if (typeof r === "object" && r && (r as AnyRow).kind === "trainable") trainable.push(label);
    else nice.push(label);
  }
  return { nice, trainable };
}

function readStages(v: unknown): RoleStage[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => {
      const row = obj(s);
      const format = asStr(row.format);
      return {
        name: asStr(row.name).trim(),
        format: (STAGE_FORMATS.has(format) ? format : "other") as InterviewStageFormat,
        ownerName: asStr(row.ownerName ?? row.owner_name).trim(),
        ownerEmail: asStr(row.ownerEmail ?? row.owner_email).trim(),
      };
    })
    .filter((s) => s.name.length > 0)
    .slice(0, MAX_INTERVIEW_STAGES);
}

/**
 * Everything the edit screen shows, read from where each answer is actually
 * stored. Every intake answer has exactly one place it is read from first;
 * the generated blueprint only fills what nobody answered.
 */
export function positionToEditForm(p: AnyRow, screeningRows: AnyRow[] = []): PositionEditInitial {
  const comp = obj(p.compensation);
  const wa = obj(p.work_authorization);
  const ctx = obj(p.intake_context);
  const brief = obj(ctx.brief);
  const blueprint = obj(p.blueprint);
  const blueprintRole = obj(blueprint.role);
  const blueprintProfile = obj(blueprint.candidate_profile);
  const blueprintGeography = obj(blueprint.geography);
  const blueprintTimeline = obj(blueprint.timeline);
  const blueprintSourcing = obj(blueprint.sourcing_plan);
  const blueprintComp = obj(blueprint.compensation);
  const posting = obj(ctx.posting);

  const rawWorkModel = firstText(p.work_model, ctx.work_model, brief.workModel, blueprintRole.work_model);
  const workModel: PositionEditInitial["work_model"] =
    rawWorkModel === "remote" || rawWorkModel === "hybrid" || rawWorkModel === "onsite"
      ? rawWorkModel
      : "";
  const rawEmploymentType = firstText(
    p.employment_type,
    ctx.employment_type,
    brief.employmentType,
    blueprintRole.employment_type,
  );
  const employmentType: PositionEditInitial["employment_type"] = (
    ["full_time", "part_time", "contract", "temporary", "internship"] as const
  ).includes(rawEmploymentType as never)
    ? (rawEmploymentType as PositionEditInitial["employment_type"])
    : "";

  const preferred = preferredByKind(p.preferred_requirements);
  const stages = readStages(ctx.interview_stages ?? brief.interviewStages);

  const zones = asStrArr(
    Array.isArray(ctx.remote_timezones) ? ctx.remote_timezones : brief.remoteTimezones,
  ).filter((z) => TIMEZONE_BANDS.has(z));
  const anywhere =
    ctx.remote_anywhere_in_country === true || brief.remoteAnywhereInCountry === true;

  const onsite = wholeNumberIn(ctx.onsite_days ?? brief.onsiteDays, 0, 7);

  const sponsorshipText = firstText(ctx.sponsorship_available, brief.sponsorshipAvailable);
  const sponsorship: RoleIntakeAnswers["sponsorship_available"] =
    sponsorshipText === "yes" || sponsorshipText === "no"
      ? sponsorshipText
      : typeof wa.sponsorship_available === "boolean"
        ? wa.sponsorship_available
          ? "yes"
          : "no"
        : "";

  const rule = firstText(wa.rule, brief.workAuthorization);
  const equity = firstText(comp.equity);
  const targetDays = wholeNumberIn(
    ctx.target_days_to_offer ?? brief.targetDaysToOffer,
    MIN_TARGET_DAYS_TO_OFFER,
    MAX_TARGET_DAYS_TO_OFFER,
  );

  const form: PositionEditInitial = {
    id: p.id,
    organization_id: p.organization_id,
    organization_name: p.organizations?.name ?? "",
    status: p.status ?? "draft",
    visibility: p.visibility ?? "private",

    title: firstText(p.title, brief.roleTitle, blueprintRole.title),
    department: firstText(p.department, ctx.team, brief.team, blueprintRole.department),
    location: firstText(p.location, ctx.location, brief.location, blueprintRole.location),
    work_model: workModel,
    employment_type: employmentType,
    // Stored briefs use mixed casing; the picker only matches its own labels.
    seniority: normalizeSeniority(
      firstText(p.seniority, ctx.seniority, brief.seniority, blueprintRole.seniority),
    ),
    headcount:
      typeof p.openings === "number"
        ? p.openings
        : typeof blueprintRole.headcount === "number"
          ? blueprintRole.headcount
          : "",
    description: firstText(
      p.description,
      ctx.job_description,
      ctx.jobDescriptionText,
      brief.jobDescription,
      brief.jobDescriptionText,
      p.jd_text,
      blueprintRole.summary,
    ),

    open_worldwide: Boolean(
      ctx.open_worldwide ?? brief.openWorldwide ?? blueprintGeography.open_worldwide,
    ),
    target_countries: firstList(wa.countries, ctx.target_countries, blueprintGeography.target_countries),
    states_regions: asStrArr(ctx.states_regions),
    metro_areas: asStrArr(ctx.metro_areas),
    search_radius: asStr(ctx.search_radius),
    hiring_urgency: firstText(
      comp.urgency,
      ctx.hiring_urgency,
      ctx.hiring_timeline,
      blueprintTimeline.hiring_urgency,
    ),
    // The date box only shows a calendar date; prose stays in the brief.
    target_start_date:
      isoDateOrNull(p.target_start_date) ??
      isoDateOrNull(ctx.target_start_date) ??
      isoDateOrNull(brief.targetStartDate) ??
      isoDateOrNull(blueprintTimeline.target_start_date) ??
      "",
    // The intake's "target days from shortlist to offer" is this field.
    time_to_hire: targetDays !== null
      ? String(targetDays)
      : firstText(ctx.time_to_hire, blueprintTimeline.time_to_hire),

    must_have_skills: firstList(p.requirements, ctx.must_have_skills, brief.mustHaves, blueprint.must_have_skills),
    nice_to_have_skills:
      preferred.nice.length > 0
        ? preferred.nice
        : preferred.trainable.length > 0
          ? []
          : firstList(ctx.nice_to_have_skills, brief.niceToHaves, blueprint.nice_to_have_skills),
    certifications_list: firstList(ctx.certifications_list, blueprint.certifications),
    tools_platforms: firstList(ctx.tools_platforms, blueprint.tools_platforms),
    experience: firstText(ctx.experience, blueprintProfile.experience),
    education: firstText(ctx.education, blueprintProfile.education),
    timezone_requirements: firstText(ctx.timezone_requirements, blueprintGeography.timezone_requirements),
    responsibilities: firstList(ctx.responsibilities, blueprint.responsibilities).join("\n") ||
      asStr(ctx.responsibilities),
    additional_requirements: asStr(ctx.additional_requirements),

    currency: firstText(comp.currency, ctx.currency, blueprintComp.currency) || "USD",
    budget_period: firstText(comp.budget_period, comp.period, ctx.budget_period) || "year",
    budget_min: comp.undecided === true ? "" : firstText(comp.budget_min, comp.min, ctx.budget_min, blueprintComp.min),
    budget_max: comp.undecided === true ? "" : firstText(comp.budget_max, comp.max, ctx.budget_max, blueprintComp.max),
    compensation: firstText(comp.summary, comp.text, comp.note, blueprintComp.note),

    target_titles: firstList(wa.target_titles, ctx.target_titles, blueprintSourcing.target_titles),
    title_match_timing: (asStr(ctx.title_match_timing) as PositionEditInitial["title_match_timing"]) || "",
    target_company_types: firstList(ctx.target_company_types, blueprintSourcing.target_company_types),
    include_keywords: firstList(ctx.include_keywords, blueprintSourcing.include_keywords),
    exclude_keywords: firstList(ctx.exclude_keywords, blueprintSourcing.exclude_keywords),
    disqualifier_tags: firstList(p.dealbreakers, ctx.deal_breaker_list, brief.dealBreakers, blueprint.dealbreakers),
    interview_process: firstText(ctx.interview_process, brief.interviewProcess),
    additional_context: asStr(ctx.additional_context),
    company_intro: asStr(posting.company_intro),
    benefits: asStr(posting.benefits),
    languages: asStr(posting.languages),
    travel: asStr(posting.travel) || asStr(p.travel_expectation) || asStr(brief.travelExpectation),
    work_authorization_note: asStr(posting.work_authorization_note),
    accessibility_note: asStr(posting.accessibility_note),
    eeo_statement: asStr(posting.eeo_statement),
    brand_tone: asStr(posting.brand_tone),
    application_deadline: asStr(posting.application_deadline),
    confidentiality: asStr(posting.confidentiality) || "public",
    screening_questions: (screeningRows ?? []).map((r) => ({
      id: r.id,
      question: r.question,
      answer_type: r.answer_type,
      required: !!r.required,
      dealbreaker: !!r.dealbreaker,
      must_have: (r.must_have as string) ?? "",
      why_asked: (r.why_asked as string) ?? "",
    })),

    // The intake answers the editor now shows, read from where the intake
    // stored them.
    remote_timezones: zones,
    remote_anywhere_in_country: anywhere,
    onsite_days: onsite === null ? "" : onsite,
    sponsorship_available: sponsorship,
    work_authorization_rule: (AUTH_RULES.has(rule) ? rule : "") as RoleIntakeAnswers["work_authorization_rule"],
    work_authorization_rule_note: asStr(wa.note).slice(0, 1000),
    compensation_undecided: comp.undecided === true,
    compensation_flexible: comp.flexible === true,
    bonus_structure: asStr(comp.bonus).slice(0, 500),
    equity: (EQUITY.has(equity) ? equity : "") as RoleIntakeAnswers["equity"],
    trainable_skills: preferred.trainable.length > 0 ? preferred.trainable : splitLines(asStr(brief.trainable)),
    interview_stages: stages,
    decision_maker: firstText(ctx.decision_maker, brief.decisionMaker).slice(0, 160),
    decision_maker_email: firstText(ctx.decision_maker_email, brief.decisionMakerEmail).slice(0, 255),
  };

  // Fit every registry field to its own limits, so a loaded value can never be
  // the reason a save fails.
  for (const key of Object.keys(form) as Array<keyof PositionEditInitial>) {
    const fitted = fitToField(key, form[key]);
    (form as Record<string, unknown>)[key] = fitted;
  }
  return form;
}

/* ------------------------------------------------------------------ */
/* Requiredness: one rule set for the edit screen and the save handler */
/* ------------------------------------------------------------------ */

export type RoleRequirednessInput = Pick<
  PositionEditInitial,
  | "title"
  | "description"
  | "must_have_skills"
  | "budget_min"
  | "budget_max"
  | "work_model"
  | "location"
  | "remote_timezones"
  | "remote_anywhere_in_country"
  | "onsite_days"
  | "sponsorship_available"
  | "work_authorization_rule"
  | "interview_process"
  | "interview_stages"
  | "decision_maker"
  | "decision_maker_email"
  | "disqualifier_tags"
  | "compensation_undecided"
>;

/** Which wizard step each blocking field lives on. */
export const ROLE_FIELD_STEP: Record<string, number> = {
  title: 1,
  must_have_skills: 2,
  budget_max: 3,
  decision_maker_email: 4,
  interview_stages: 4,
};

const num = (v: string) => Number(String(v ?? "").replace(/[^0-9.]/g, ""));

/**
 * What a save may refuse, and what it merely mentions.
 *
 * Refused (`errors`): only what sourcing cannot start without — a role name and
 * at least one must-have (or a description to read them from) — plus values
 * that contradict themselves (a range whose top is below its bottom, an email
 * that is not one). Mirrors the intake: the intake also asks for one must-have,
 * not three.
 *
 * Mentioned (`missing`, `optional`): exactly the intake's own "Brief
 * incomplete" list (briefCompleteness). Never blocking. Time zone and city are
 * never required: a remote role needs neither, and "anywhere in the country"
 * is a complete answer.
 */
export function roleRequiredness(form: RoleRequirednessInput): {
  errors: Record<string, string>;
  missing: string[];
  optional: string[];
} {
  const errors: Record<string, string> = {};
  const title = (form.title ?? "").trim();
  if (title.length < 2) errors.title = "Give the role a name (at least 2 characters)";
  else if (title.length > 200) errors.title = "Keep the job title to 200 characters or fewer";

  const mustHaves = (form.must_have_skills ?? []).filter((s) => s.trim().length > 0);
  const descriptionChars = (form.description ?? "").replace(/<[^>]*>/g, "").trim().length;
  if (mustHaves.length < MIN_MUST_HAVES && descriptionChars < 40) {
    errors.must_have_skills = "Add at least one must-have requirement";
  }

  const min = num(form.budget_min);
  const max = num(form.budget_max);
  if (min > 0 && max > 0 && max < min) {
    errors.budget_max = "The top of the range must be at least the bottom";
  }

  const dmEmail = (form.decision_maker_email ?? "").trim();
  if (dmEmail && !isValidOwnerEmail(dmEmail)) {
    errors.decision_maker_email = "Enter a valid email address, or leave it blank";
  }
  const badStage = (form.interview_stages ?? []).find(
    (s) => s.name.trim() && s.ownerEmail.trim() && !isValidOwnerEmail(s.ownerEmail),
  );
  if (badStage) errors.interview_stages = `Check the email for “${badStage.name.trim()}”`;

  const brief = briefCompleteness({
    location: form.location ?? "",
    workModel: form.work_model ?? "",
    remoteTimezones: form.remote_timezones ?? [],
    remoteAnywhereInCountry: form.remote_anywhere_in_country === true,
    salaryMin: form.compensation_undecided ? 0 : min || 0,
    workAuthorization: form.work_authorization_rule || form.sponsorship_available || "",
    interviewProcess: form.interview_process ?? "",
    interviewStages: form.interview_stages ?? [],
    decisionMaker: form.decision_maker ?? "",
    dealBreakers: "",
    dealBreakerList: form.disqualifier_tags ?? [],
  });

  return { errors, missing: brief.missing, optional: brief.optional };
}

/* ------------------------------------------------------------------ */
/* edit form → positions patch                                         */
/* ------------------------------------------------------------------ */

export type RoleSaveData = Omit<
  PositionEditInitial,
  "organization_id" | "organization_name" | "status" | "visibility" | "headcount"
> & {
  headcount: number | null;
  location_changed?: boolean;
};

export type RoleExistingColumns = {
  intake_context?: unknown;
  compensation?: unknown;
  work_authorization?: unknown;
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
  location?: string | null;
  work_model?: string | null;
  description?: string | null;
};

function preserveRequirementMetadata(labels: string[], current: unknown, kind?: string) {
  const rows = Array.isArray(current) ? (current as AnyRow[]) : [];
  return labels.map((label, i) => {
    const matched = rows.find(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        String(row.label ?? "").trim().toLowerCase() === label.trim().toLowerCase(),
    );
    const base = matched ? { ...matched, label } : { label, ...(kind ? { kind } : {}) };
    // A label moved between lists takes its new list's meaning.
    if (kind) base.kind = kind;
    if (kind === "trainable") Object.assign(base, { filters: false, orders: false });
    if (kind === "nice_to_have") Object.assign(base, { filters: false, orders: true });
    if (kind === "must_have") Object.assign(base, { filters: true });
    if (typeof base.rank !== "number") base.rank = i + 1;
    return base;
  });
}

/**
 * The positions patch for a save. `sanitizedDescription` is the description
 * after the caller's markup sanitiser (kept out of this module so it stays
 * free of DOM-ish helpers).
 */
export function editFormToPositionPatch(
  data: RoleSaveData,
  existing: RoleExistingColumns | null | undefined,
  opts: { sanitizedDescription?: string; now?: string } = {},
): Record<string, unknown> {
  const prior = existing ?? {};
  const priorCtx = obj(prior.intake_context);
  const priorComp = obj(prior.compensation);
  const priorWA = obj(prior.work_authorization);
  const priorBrief = obj(priorCtx.brief);
  const description = opts.sanitizedDescription ?? data.description ?? "";

  // The location box on the Practicalities step is the client's answer. When
  // they did not touch it, keep whatever the column holds — the structured
  // locations editor may have just written a fresher label.
  const nextLocation = data.location_changed
    ? data.location.trim() || null
    : (prior.location as string | null) || data.location.trim() || null;
  const workModel = data.work_model || (prior.work_model as string | null) || null;

  const remote = workModel === "remote";
  const hybrid = workModel === "hybrid";
  const zones = remote && !data.remote_anywhere_in_country ? data.remote_timezones : [];
  const anywhere = remote && data.remote_anywhere_in_country === true;
  const onsiteDays = hybrid && typeof data.onsite_days === "number" ? data.onsite_days : null;

  const stages = (data.interview_stages ?? [])
    .filter((s) => s.name.trim().length > 0)
    .map((s) => ({
      name: s.name.trim(),
      format: s.format,
      ownerName: s.ownerName.trim(),
      ownerEmail: s.ownerEmail.trim().toLowerCase(),
    }));
  const targetDays = wholeNumberIn(data.time_to_hire, MIN_TARGET_DAYS_TO_OFFER, MAX_TARGET_DAYS_TO_OFFER);
  const interviewProcess =
    data.interview_process.trim() ||
    (stages.length > 0 ? interviewProcessSummary(stages as InterviewStage[], targetDays) : "");

  const dealBreakers = normalizeDealBreakers(data.disqualifier_tags);
  const undecided = data.compensation_undecided === true && !data.budget_min && !data.budget_max;
  const startDate = isoDateOrNull(data.target_start_date);

  const brief = briefCompleteness({
    location: nextLocation ?? "",
    workModel: workModel ?? "",
    remoteTimezones: zones,
    remoteAnywhereInCountry: anywhere,
    salaryMin: num(data.budget_min) || 0,
    workAuthorization: data.work_authorization_rule || data.sponsorship_available || "",
    interviewProcess,
    interviewStages: stages,
    decisionMaker: data.decision_maker,
    dealBreakers: dealBreakers.join("\n"),
    dealBreakerList: dealBreakers,
  });

  const sponsorshipBool =
    data.sponsorship_available === "yes"
      ? true
      : data.sponsorship_available === "no"
        ? false
        : typeof priorWA.sponsorship_available === "boolean"
          ? priorWA.sponsorship_available
          : undefined;

  const collaborators = collaboratorCandidates(stages as InterviewStage[], {
    name: data.decision_maker,
    email: data.decision_maker_email,
  });

  return {
    title: data.title.trim(),
    department: data.department || null,
    location: nextLocation,
    work_model: workModel,
    employment_type: data.employment_type || null,
    seniority: data.seniority || null,
    description: description || null,
    target_start_date: startDate,
    requirements: preserveRequirementMetadata(data.must_have_skills, prior.requirements, "must_have"),
    preferred_requirements: [
      ...preserveRequirementMetadata(data.nice_to_have_skills, prior.preferred_requirements, "nice_to_have"),
      ...preserveRequirementMetadata(data.trainable_skills ?? [], prior.preferred_requirements, "trainable"),
    ],
    dealbreakers: preserveRequirementMetadata(data.disqualifier_tags, prior.dealbreakers),
    compensation: {
      ...priorComp,
      summary: data.compensation || null,
      note: data.compensation || null,
      urgency: data.hiring_urgency || null,
      currency: data.currency || null,
      budget_period: data.budget_period || null,
      period: data.budget_period || null,
      budget_min: undecided ? null : data.budget_min || null,
      min: undecided ? null : data.budget_min ? num(data.budget_min) : null,
      budget_max: undecided ? null : data.budget_max || null,
      max: undecided ? null : data.budget_max ? num(data.budget_max) : null,
      undecided,
      flexible: data.compensation_flexible === true,
      bonus: data.bonus_structure?.trim() || null,
      equity: data.equity || null,
    },
    // Typing a range is the act of collecting it: without this flag the
    // range is treated as never gathered and reads as "Not disclosed".
    ...(data.budget_min || data.budget_max
      ? { compensation_collected: true, compensation_visibility: "public" }
      : {}),
    work_authorization: {
      ...priorWA,
      countries: data.target_countries,
      target_titles: data.target_titles,
      ...(sponsorshipBool === undefined ? {} : { sponsorship_available: sponsorshipBool }),
      rule: data.work_authorization_rule || null,
      note: data.work_authorization_rule_note?.trim() || null,
    },
    intake_context: {
      ...priorCtx,
      // Keep the legacy brief projection synchronized while canonical columns
      // remain authoritative. Older roles and downstream exports still read it.
      brief: {
        ...priorBrief,
        roleTitle: data.title,
        team: data.department || "",
        location: nextLocation ?? "",
        workModel: workModel ?? "",
        employmentType: data.employment_type || "",
        seniority: data.seniority || "",
        jobDescription: data.description || "",
        jobDescriptionText: data.description || "",
        targetStartDate: data.target_start_date || "",
        remoteTimezones: zones,
        remoteAnywhereInCountry: anywhere,
        onsiteDays,
        sponsorshipAvailable: data.sponsorship_available || priorBrief.sponsorshipAvailable || "",
        workAuthorization: data.work_authorization_rule || "",
        workAuthorizationNote: data.work_authorization_rule_note || "",
        interviewProcess,
        interviewStages: stages,
        targetDaysToOffer: targetDays,
        decisionMaker: data.decision_maker || "",
        decisionMakerEmail: data.decision_maker_email || "",
        dealBreakers,
        complete: brief.complete,
        missing: brief.missing,
      },
      team: data.department || "",
      jobDescriptionText: data.description || "",
      work_model: workModel ?? "",
      employment_type: data.employment_type || "",
      seniority: data.seniority || "",
      open_worldwide: data.open_worldwide,
      states_regions: data.states_regions,
      metro_areas: data.metro_areas,
      search_radius: data.search_radius || "",
      target_start_date: data.target_start_date || "",
      time_to_hire: data.time_to_hire || "",
      target_days_to_offer: targetDays,
      certifications_list: data.certifications_list,
      tools_platforms: data.tools_platforms,
      experience: data.experience || "",
      education: data.education || "",
      timezone_requirements: data.timezone_requirements || "",
      responsibilities: data.responsibilities || "",
      additional_requirements: data.additional_requirements || "",
      title_match_timing: data.title_match_timing || "",
      target_company_types: data.target_company_types,
      include_keywords: data.include_keywords,
      exclude_keywords: data.exclude_keywords,
      interview_process: interviewProcess,
      interview_stages: stages,
      additional_context: data.additional_context || "",
      // The intake's own keys, so every surface that reads the intake's
      // answers (role page, duplicate-role, carry-forward) reads the edit too.
      remote_timezones: zones,
      remote_anywhere_in_country: anywhere,
      onsite_days: onsiteDays,
      sponsorship_available: data.sponsorship_available || priorCtx.sponsorship_available || null,
      decision_maker: data.decision_maker || null,
      decision_maker_email: data.decision_maker_email?.trim().toLowerCase() || null,
      deal_breakers: dealBreakers.join("\n") || null,
      deal_breaker_list: dealBreakers,
      collaborator_candidates: priorCtx.collaborator_invites_opted_in === true ? collaborators : (priorCtx.collaborator_candidates ?? []),
      brief_complete: brief.complete,
      brief_missing: brief.missing,
      posting: {
        ...obj(priorCtx.posting),
        company_intro: data.company_intro || "",
        // The public listing reads its sections from posting.*, so anything
        // marked public in the field registry must be written here too.
        responsibilities: data.responsibilities || "",
        benefits: data.benefits || "",
        languages: data.languages || "",
        travel: data.travel || "",
        work_authorization_note: data.work_authorization_note || "",
        accessibility_note: data.accessibility_note || "",
        eeo_statement: data.eeo_statement || "",
        brand_tone: data.brand_tone || "",
        application_deadline: data.application_deadline || "",
        confidentiality: data.confidentiality || "public",
      },
    },
    openings: typeof data.headcount === "number" ? data.headcount : 1,
    updated_at: opts.now ?? new Date().toISOString(),
  };
}

/**
 * Whether a save changed what the role analysis reads (the description or the
 * must-haves). Such an edit queues a fresh analysis.
 */
export function analysisInputsChanged(
  before: { description?: string | null; requirements?: unknown },
  after: { description?: string | null; requirements?: unknown },
): boolean {
  const norm = (s: unknown) => asStr(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const reqs = (v: unknown) => fromJsonArray(v).map((l) => l.trim().toLowerCase()).sort().join("|");
  return norm(before.description) !== norm(after.description) || reqs(before.requirements) !== reqs(after.requirements);
}

/* ------------------------------------------------------------------ */
/* intake answers → positions row                                      */
/* ------------------------------------------------------------------ */

/** The intake fields this mapping reads (a subset of ExpressIntakeInput). */
export type IntakeAnswers = {
  roleTitle: string;
  team?: string;
  jobDescriptionText?: string;
  jobDescriptionFile?: unknown;
  mustHaves?: string;
  niceToHaves?: string;
  trainable?: string;
  requirements?: Array<{ text: string; tag: RequirementTag }>;
  location?: string;
  workModel?: string;
  seniority?: string;
  employmentType?: string;
  onsiteDays?: number;
  remoteTimezones?: string[];
  remoteAnywhereInCountry?: boolean;
  currency?: string;
  compensationPeriod?: string;
  salaryMin?: number;
  salaryMax?: number;
  compensationNote?: string;
  compensationUndecided?: boolean;
  bonusStructure?: string;
  equity?: string;
  compensationFlexible?: boolean;
  wideRangeConfirmed?: boolean;
  workAuthorization?: string;
  sponsorshipAvailable?: string;
  workAuthorizationNote?: string;
  targetStartDate?: string;
  interviewProcess?: string;
  interviewStages?: InterviewStage[];
  targetDaysToOffer?: number;
  decisionMaker?: string;
  decisionMakerEmail?: string;
  inviteCollaborators?: boolean;
  dealBreakers?: string;
  dealBreakerList?: string[];
};

/**
 * The positions row an intake creates, minus the tenancy and audit columns the
 * handler owns (organization_id, created_by, owner_user_id, status…).
 *
 * Every answer lands somewhere positionToEditForm() reads it back from — the
 * round-trip test proves it field by field.
 */
export function intakePayloadToPosition(data: IntakeAnswers, opts: { now?: string } = {}) {
  const now = opts.now ?? new Date().toISOString();
  // The tagged list is the source of truth when the client sent one: it
  // carries the order they chose and the tag that decides how each item is
  // used. Older payloads only had the three strings, so fall back to those.
  const tagged = (data.requirements ?? []).filter((r) => r.text.trim().length > 0);
  const pickTagged = (tag: RequirementTag) =>
    tagged.filter((r) => r.tag === tag).map((r) => r.text.trim());
  const mustHaves = tagged.length > 0 ? pickTagged("must_have") : splitLines(data.mustHaves);
  const trainable = tagged.length > 0 ? pickTagged("trainable") : splitLines(data.trainable);
  const niceToHaves = tagged.length > 0 ? pickTagged("nice_to_have") : splitLines(data.niceToHaves);
  const source = tagged.length > 0 ? "client_tagged" : "client_intake";

  const dealbreakerLines =
    (data.dealBreakerList ?? []).length > 0
      ? normalizeDealBreakers(data.dealBreakerList)
      : splitLines((data.dealBreakers ?? "").trim());
  const dealBreakersText = dealbreakerLines.join("\n");
  const locationText = (data.location ?? "").trim();
  const workModel = data.workModel || "";

  const interviewStages = (data.interviewStages ?? []).filter((s) => (s.name ?? "").trim().length > 0);
  const targetDaysToOffer = typeof data.targetDaysToOffer === "number" ? data.targetDaysToOffer : null;
  const interviewProcessText =
    interviewStages.length > 0
      ? interviewProcessSummary(interviewStages, targetDaysToOffer)
      : (data.interviewProcess ?? "").trim();
  const decisionMakerText = (data.decisionMaker ?? "").trim();
  const decisionMakerEmailText = (data.decisionMakerEmail ?? "").trim().toLowerCase();
  // Owners are recorded, never contacted. Invitations require the opt-in.
  const inviteCollaborators = data.inviteCollaborators === true;
  const collaborators = collaboratorCandidates(interviewStages, {
    name: decisionMakerText,
    email: decisionMakerEmailText,
  });

  const hasComp = typeof data.salaryMin === "number" && typeof data.salaryMax === "number";
  const compUndecided = data.compensationUndecided === true;
  /**
   * Compensation is stored as what the client said: a range, or an explicit
   * "undecided". Never a zero standing in for "we don't know".
   */
  const compensationRecord: Record<string, unknown> =
    hasComp || compUndecided || data.compensationFlexible || data.equity || data.bonusStructure ||
    (data.compensationNote ?? "").trim()
      ? {
          undecided: compUndecided,
          currency: hasComp ? data.currency ?? "USD" : data.currency ?? null,
          period: hasComp ? data.compensationPeriod ?? "year" : data.compensationPeriod ?? null,
          min: hasComp ? data.salaryMin : null,
          max: hasComp ? data.salaryMax : null,
          bonus: (data.bonusStructure ?? "").trim() || null,
          equity: data.equity || null,
          flexible: data.compensationFlexible === true,
          wide_range_confirmed: data.wideRangeConfirmed === true,
          note: (data.compensationNote ?? "").trim() || null,
          source: "client_intake",
        }
      : // The column is NOT NULL; "nothing said yet" is an empty record,
        // never a null that would reject the whole submission.
        {};

  const remoteTimezones = workModel === "remote" ? data.remoteTimezones ?? [] : [];
  const remoteAnywhere = workModel === "remote" && data.remoteAnywhereInCountry === true;
  const onsiteDays = workModel === "hybrid" && typeof data.onsiteDays === "number" ? data.onsiteDays : null;
  const startDateRaw = (data.targetStartDate ?? "").trim();
  const startDate = isoDateOrNull(startDateRaw);

  const brief = briefCompleteness({
    location: locationText,
    workModel,
    remoteTimezones,
    remoteAnywhereInCountry: remoteAnywhere,
    salaryMin: data.salaryMin ?? 0,
    workAuthorization: data.workAuthorization ?? "",
    interviewProcess: interviewProcessText,
    interviewStages,
    decisionMaker: decisionMakerText,
    dealBreakers: dealBreakersText,
    dealBreakerList: dealbreakerLines,
  });

  const position = {
    title: data.roleTitle.trim(),
    department: (data.team ?? "").trim() || null,
    work_model: workModel || null,
    // Both come from the job description, not from a question the client was
    // asked. The publish gate requires them, so a brief that carries them
    // arrives ready instead of going back for details (audit 15 Sep, INT-002).
    seniority: (data.seniority ?? "").trim() || null,
    employment_type: data.employmentType || "full_time",
    location: locationText || null,
    description: (data.jobDescriptionText ?? "").trim() || null,
    // Must-haves filter the shortlist and drive the evidence bullets the client
    // reads. Nice-to-haves order it. Trainable items are stored as explicitly
    // non-filtering so nothing downstream can screen on them.
    requirements: mustHaves.map((label, i) => ({
      label,
      kind: "must_have",
      rank: i + 1,
      filters: true,
      source,
    })),
    preferred_requirements: [
      ...niceToHaves.map((label, i) => ({
        label,
        kind: "nice_to_have",
        rank: i + 1,
        filters: false,
        orders: true,
        source,
      })),
      ...trainable.map((label, i) => ({
        label,
        kind: "trainable",
        rank: i + 1,
        filters: false,
        orders: false,
        source,
      })),
    ],
    dealbreakers: dealbreakerLines.map((label) => ({ label })),
    compensation: compensationRecord,
    compensation_collected: hasComp,
    compensation_visibility: "internal",
    work_authorization: {
      // Sponsorship is always answered, so it is always recorded.
      sponsorship_available: data.sponsorshipAvailable === "yes",
      ...(data.workAuthorization
        ? {
            rule: data.workAuthorization,
            note: (data.workAuthorizationNote ?? "").trim() || null,
          }
        : {}),
    },
    target_start_date: startDate,
    intake_context: {
      team: (data.team ?? "").trim() || null,
      deal_breakers: dealBreakersText || null,
      deal_breaker_list: dealbreakerLines,
      interview_process: interviewProcessText || null,
      interview_stages: interviewStages,
      target_days_to_offer: targetDaysToOffer,
      decision_maker: decisionMakerText || null,
      decision_maker_email: decisionMakerEmailText || null,
      // Recorded so the team can offer invitations later, on request.
      collaborator_invites_opted_in: inviteCollaborators,
      collaborator_candidates: inviteCollaborators ? collaborators : [],
      onsite_days: onsiteDays,
      remote_timezones: remoteTimezones,
      remote_anywhere_in_country: remoteAnywhere,
      sponsorship_available: data.sponsorshipAvailable,
      // A start date the parser wrote as prose cannot go in the date column;
      // it is kept here rather than failing the submission.
      ...(startDateRaw && !startDate ? { target_start_date_note: startDateRaw } : {}),
      brief_complete: brief.complete,
      brief_missing: brief.missing,
      collected_at: now,
      collected_via: "express_intake",
    },
    jd_source: data.jobDescriptionFile ? "file" : "pasted",
    // Queued, not "analyzing": nothing is analysing it yet. The run is started
    // by /api/public/blueprint-run (see blueprint-trigger.ts for why).
    blueprint_status: "queued",
  };

  return {
    position,
    brief,
    tagged,
    mustHaves,
    niceToHaves,
    trainable,
    dealbreakerLines,
    interviewStages,
    interviewProcessText,
    targetDaysToOffer,
    decisionMakerText,
    decisionMakerEmailText,
    inviteCollaborators,
    collaborators,
    compensationRecord,
    locationText,
  };
}
