/**
 * The one definition of a position field.
 *
 * Every surface that shows or edits a role reads from this registry: the public
 * intake wizard, the client editor, the admin editor and the public job
 * listing. Name, label, hint, type, options and validation live here once, so
 * two forms cannot disagree on a word or a rule, and a field is absent from a
 * surface only because the flags below say so.
 *
 * Flags:
 *  - requiredAtIntake  — the intake wizard blocks submission without it
 *  - clientEditable    — the client's role editor renders it
 *  - adminEditable     — the admin position editor renders it
 *  - publicListing     — the public job page may render it
 */
import { z } from "zod";

export type PositionFieldType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "list"
  | "boolean"
  | "date";

export type PositionFieldOption = { value: string; label: string };

export type PositionField = {
  /** Canonical name — the key used by the shared read/write server module. */
  name: string;
  /** Key the intake wizard keeps this answer under, when it asks for it. */
  intakeKey?: string;
  label: string;
  /** Heading used when the field renders on the public job page. */
  publicLabel?: string;
  hint?: string;
  type: PositionFieldType;
  options?: readonly PositionFieldOption[];
  schema: z.ZodTypeAny;
  requiredAtIntake: boolean;
  clientEditable: boolean;
  adminEditable: boolean;
  publicListing: boolean;
};

const opt = (...values: Array<[string, string]>): readonly PositionFieldOption[] =>
  values.map(([value, label]) => ({ value, label }));

export const EMPLOYMENT_TYPE_OPTIONS = opt(
  ["full_time", "Full time"],
  ["part_time", "Part time"],
  ["contract", "Contract"],
  ["temporary", "Temporary"],
  ["internship", "Internship"],
);

export const WORK_MODEL_OPTIONS = opt(
  ["remote", "Remote"],
  ["hybrid", "Hybrid"],
  ["onsite", "On site"],
);

export const SENIORITY_OPTIONS = opt(
  ["Intern", "Intern"],
  ["Junior", "Junior"],
  ["Mid", "Mid"],
  ["Senior", "Senior"],
  ["Lead", "Lead"],
  ["Staff", "Staff"],
  ["Principal", "Principal"],
  ["Director", "Director"],
  ["VP", "VP"],
  ["C-Level", "C-Level"],
);

export const CURRENCY_OPTIONS = opt(
  ["USD", "USD"],
  ["EUR", "EUR"],
  ["GBP", "GBP"],
  ["CAD", "CAD"],
  ["AUD", "AUD"],
  ["BRL", "BRL"],
  ["INR", "INR"],
);

export const BUDGET_PERIOD_OPTIONS = opt(
  ["year", "Per year"],
  ["month", "Per month"],
  ["hour", "Per hour"],
);

export const TITLE_MATCH_TIMING_OPTIONS = opt(
  ["current", "Current title"],
  ["previous", "A previous title"],
  ["either", "Either"],
);

export const CONFIDENTIALITY_OPTIONS = opt(
  ["public", "Named on the job board"],
  ["confidential", "Confidential employer"],
);

const list = (max: number, itemMax: number) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max).default([]);

const text = (max: number) => z.string().trim().max(max).default("");

export const POSITION_FIELDS: readonly PositionField[] = [
  /* ---- The role ---------------------------------------------------- */
  {
    name: "title",
    intakeKey: "roleTitle",
    label: "Job title",
    type: "text",
    schema: z.string().trim().min(3, "Job title must be at least 3 characters").max(200),
    requiredAtIntake: true,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "department",
    intakeKey: "team",
    label: "Team",
    hint: "Which team it sits in.",
    type: "text",
    schema: text(200),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "location",
    intakeKey: "location",
    label: "Where is the role based?",
    type: "text",
    schema: text(200),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "work_model",
    intakeKey: "workModel",
    label: "How does it work?",
    type: "select",
    options: WORK_MODEL_OPTIONS,
    schema: z.enum(["remote", "hybrid", "onsite"]),
    requiredAtIntake: true,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "employment_type",
    label: "Employment type",
    type: "select",
    options: EMPLOYMENT_TYPE_OPTIONS,
    schema: z
      .enum(["full_time", "part_time", "contract", "temporary", "internship", ""])
      .default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "seniority",
    label: "Seniority level",
    type: "select",
    options: SENIORITY_OPTIONS,
    schema: text(60),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "headcount",
    label: "Positions to fill",
    type: "number",
    schema: z.number().int().min(1).max(999).nullable(),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },
  {
    name: "description",
    intakeKey: "jobDescriptionText",
    label: "Job description",
    hint: "Paste the JD or write it here. We use this to enrich matching.",
    type: "textarea",
    schema: z.string().trim().max(20_000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
  },

  /* ---- Coverage and eligibility ------------------------------------ */
  {
    name: "open_worldwide",
    intakeKey: "openWorldwide",
    label: "Open worldwide",
    type: "boolean",
    schema: z.boolean().default(false),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "target_countries",
    label: "Countries you can hire in",
    type: "list",
    schema: list(60, 80),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "states_regions",
    label: "States or regions",
    type: "list",
    schema: list(60, 120),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "metro_areas",
    label: "Metro areas",
    type: "list",
    schema: list(60, 120),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "search_radius",
    label: "Search radius",
    type: "text",
    schema: text(80),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },

  /* ---- Timing ------------------------------------------------------- */
  {
    name: "hiring_urgency",
    label: "Hiring timeline",
    type: "text",
    schema: text(80),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "target_start_date",
    intakeKey: "startDate",
    label: "Ideal start date",
    type: "date",
    schema: text(40),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "time_to_hire",
    intakeKey: "targetDaysToOffer",
    label: "Target days from shortlist to offer",
    type: "text",
    schema: text(80),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },

  /* ---- Requirements ------------------------------------------------- */
  {
    name: "must_have_skills",
    intakeKey: "mustHaves",
    label: "Must-have skills",
    type: "list",
    schema: list(30, 80),
    requiredAtIntake: true,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "What we need",
  },
  {
    name: "nice_to_have_skills",
    intakeKey: "niceToHaves",
    label: "Nice-to-have skills",
    type: "list",
    schema: list(30, 80),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Nice to have",
  },
  {
    name: "certifications_list",
    label: "Required certifications",
    type: "list",
    schema: list(30, 120),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "tools_platforms",
    label: "Required tools and platforms",
    type: "list",
    schema: list(30, 120),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "experience",
    label: "Minimum experience",
    hint: "Years of relevant experience.",
    type: "text",
    schema: text(200),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "education",
    label: "Education requirement",
    type: "text",
    schema: text(400),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "timezone_requirements",
    label: "Required timezone coverage",
    type: "text",
    schema: text(200),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "responsibilities",
    label: "Core responsibilities",
    hint: "Top outcomes and day-to-day scope.",
    type: "textarea",
    schema: z.string().max(6000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Responsibilities",
  },
  {
    name: "additional_requirements",
    label: "Additional requirements",
    type: "textarea",
    schema: z.string().max(4000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },

  /* ---- Compensation -------------------------------------------------- */
  {
    name: "currency",
    intakeKey: "currency",
    label: "Currency",
    type: "select",
    options: CURRENCY_OPTIONS,
    schema: z.string().trim().max(8).default("USD"),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "budget_period",
    intakeKey: "compensationPeriod",
    label: "Period",
    type: "select",
    options: BUDGET_PERIOD_OPTIONS,
    schema: z.enum(["year", "month", "hour"]).default("year"),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "budget_min",
    intakeKey: "salaryMin",
    label: "From",
    hint: "Base salary or contract rate.",
    type: "text",
    schema: text(20),
    requiredAtIntake: true,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "budget_max",
    intakeKey: "salaryMax",
    label: "To",
    type: "text",
    schema: text(20),
    requiredAtIntake: true,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "compensation",
    label: "Anything else about the package",
    hint: "Bonus, equity, benefits, structure — anything relevant.",
    type: "textarea",
    schema: text(2000),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Compensation",
  },

  /* ---- Sourcing rules (staff-facing) --------------------------------- */
  {
    name: "target_titles",
    label: "Target job titles",
    type: "list",
    schema: list(30, 160),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "title_match_timing",
    label: "Title match timing",
    type: "select",
    options: TITLE_MATCH_TIMING_OPTIONS,
    schema: z.enum(["current", "previous", "either", ""]).default(""),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "target_company_types",
    label: "Target company types",
    type: "list",
    schema: list(20, 120),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "include_keywords",
    label: "Include keywords",
    type: "list",
    schema: list(60, 120),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "exclude_keywords",
    label: "Exclude keywords",
    type: "list",
    schema: list(60, 120),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "disqualifier_tags",
    intakeKey: "dealBreakers",
    label: "Your deal-breakers",
    type: "list",
    schema: list(30, 200),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },

  /* ---- Process and job-post copy ------------------------------------- */
  {
    name: "interview_process",
    intakeKey: "interviewProcess",
    label: "Interview process",
    hint: "Number of rounds, format, panel.",
    type: "textarea",
    schema: z.string().max(2000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "additional_context",
    label: "Additional context",
    hint: "Anything else we should know?",
    type: "textarea",
    schema: z.string().max(4000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "company_intro",
    label: "About the company",
    type: "textarea",
    schema: z.string().max(4000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "About the company",
  },
  {
    name: "benefits",
    label: "Benefits",
    type: "textarea",
    schema: z.string().max(4000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Benefits",
  },
  {
    name: "languages",
    label: "Languages",
    type: "text",
    schema: z.string().max(500).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Languages",
  },
  {
    name: "travel",
    label: "Travel",
    type: "text",
    schema: z.string().max(300).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Travel",
  },
  {
    name: "work_authorization_note",
    label: "Work authorisation",
    type: "textarea",
    schema: z.string().max(600).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Work authorisation",
  },
  {
    name: "accessibility_note",
    label: "Accessibility and accommodations",
    type: "textarea",
    schema: z.string().max(1500).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Accessibility and accommodations",
  },
  {
    name: "eeo_statement",
    label: "Equal opportunity",
    type: "textarea",
    schema: z.string().max(3000).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Equal opportunity",
  },
  {
    name: "brand_tone",
    label: "Tone of the job post",
    type: "text",
    schema: z.string().max(60).default(""),
    requiredAtIntake: false,
    clientEditable: false,
    adminEditable: true,
    publicListing: false,
  },
  {
    name: "application_deadline",
    label: "Application deadline",
    type: "date",
    schema: z.string().max(40).default(""),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: true,
    publicLabel: "Application deadline",
  },
  {
    name: "confidentiality",
    label: "Employer name on the job board",
    type: "select",
    options: CONFIDENTIALITY_OPTIONS,
    schema: z.enum(["public", "confidential", ""]).default("public"),
    requiredAtIntake: false,
    clientEditable: true,
    adminEditable: true,
    publicListing: false,
  },
];

export type PositionFieldName = (typeof POSITION_FIELDS)[number]["name"];

const BY_NAME = new Map(POSITION_FIELDS.map((f) => [f.name, f]));
const BY_INTAKE_KEY = new Map(
  POSITION_FIELDS.filter((f) => f.intakeKey).map((f) => [f.intakeKey as string, f]),
);

export function positionField(name: string): PositionField {
  const f = BY_NAME.get(name);
  if (!f) throw new Error(`unknown_position_field:${name}`);
  return f;
}

/** The label every surface must use for this field. */
export const fieldLabel = (name: string) => positionField(name).label;
export const fieldHint = (name: string) => positionField(name).hint;
export const fieldOptions = (name: string) => positionField(name).options ?? [];
export const fieldSchema = (name: string) => positionField(name).schema;
export const isRequiredAtIntake = (name: string) => positionField(name).requiredAtIntake;

/** Intake asks its questions under its own keys; the label still comes from here. */
export function positionFieldByIntakeKey(key: string): PositionField | undefined {
  return BY_INTAKE_KEY.get(key);
}
export function intakeLabel(key: string): string | undefined {
  return BY_INTAKE_KEY.get(key)?.label;
}

export type PositionSurface = "intake" | "client" | "admin" | "public";

export function fieldsFor(surface: PositionSurface): readonly PositionField[] {
  return POSITION_FIELDS.filter((f) => {
    if (surface === "intake") return Boolean(f.intakeKey);
    if (surface === "client") return f.clientEditable;
    if (surface === "admin") return f.adminEditable;
    return f.publicListing;
  });
}

/** Zod shape for a surface — the only place a position field's rules live. */
export function positionShapeFor(surface: PositionSurface): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  for (const f of fieldsFor(surface)) shape[f.name] = f.schema;
  return shape;
}

export function positionSchemaFor(surface: PositionSurface) {
  return z.object(positionShapeFor(surface));
}

/** Sections the public job page may render, in order, with their headings. */
export const PUBLIC_LISTING_FIELDS = fieldsFor("public");
export const PUBLIC_FIELD_NAMES = PUBLIC_LISTING_FIELDS.map((f) => f.name);
export const publicHeading = (name: string) =>
  positionField(name).publicLabel ?? positionField(name).label;

/** Names editable by a role, for editors that render themselves from the schema. */
export function editableFieldNames(role: "client" | "admin"): string[] {
  return fieldsFor(role).map((f) => f.name);
}
