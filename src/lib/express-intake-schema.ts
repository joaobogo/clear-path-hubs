import { z } from "zod";

/**
 * Express onboarding contract.
 *
 * The client gives us the minimum we cannot infer — who they are, how to reach
 * them, what the role is called, and the job description. Everything else in
 * the full intake is generated afterwards into the editable Role Blueprint.
 */

export const MAX_JD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_JD_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
  "text/rtf",
]);
export const ALLOWED_JD_EXT = new Set(["pdf", "docx", "txt", "rtf"]);
/**
 * Legacy binary .doc cannot be read in the edge runtime. We name it explicitly
 * so the client gets a fix ("save as PDF or DOCX") instead of a generic reject.
 */
export const UNREADABLE_JD_EXT = new Set(["doc"]);
export const JD_ACCEPT_ATTR = ".pdf,.docx,.txt,.rtf";
export const JD_ACCEPT_LABEL = "PDF, DOCX, TXT or RTF, up to 10 MB";

export const MIN_JD_TEXT = 80;
export const MIN_ACCOUNT_PASSWORD = 8;

/** Role-brief minimums. Enforced identically on the client and the server. */
export const MIN_WHY_OPEN = 40;
export const MIN_MUST_HAVES = 2;
export const MIN_DEAL_BREAKERS = 20;
export const MIN_INTERVIEW_PROCESS = 20;

export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export const COMP_CURRENCIES = ["USD", "EUR", "GBP", "BRL", "CAD", "AUD"] as const;
export const COMP_PERIODS = ["year", "month", "hour"] as const;

export const WORK_AUTHORIZATION_OPTIONS = [
  {
    value: "already_authorized",
    label: "Must already be authorised to work in this location",
    hint: "No sponsorship or visa transfer available.",
  },
  {
    value: "will_sponsor",
    label: "We can sponsor or transfer a visa",
    hint: "Widens the pool considerably.",
  },
  {
    value: "contractor",
    label: "Contractor or agency of record",
    hint: "Candidate invoices or is employed through a third party.",
  },
] as const;

export const WORK_AUTHORIZATION_VALUES = [
  "already_authorized",
  "will_sponsor",
  "contractor",
] as const;

export const WORK_MODEL_LABELS: Record<(typeof WORK_MODELS)[number], string> = {
  remote: "Fully remote",
  hybrid: "Hybrid",
  onsite: "On site",
};

export const COMP_PERIOD_LABELS: Record<(typeof COMP_PERIODS)[number], string> = {
  year: "per year",
  month: "per month",
  hour: "per hour",
};

/** One item per line, blanks and stray bullets removed. */
export function splitLines(value: string | undefined | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 40);
}


export const jdFileSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(160),
  base64: z.string().min(1),
});

const linkedinField = (label: string) =>
  z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /linkedin\.com\//i.test(v), `Enter a valid ${label} LinkedIn URL`);

export const expressIntakeSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),

    // Company
    companyName: z.string().trim().min(2, "Enter your company name").max(160),
    companyWebsite: z
      .string()
      .trim()
      .min(3, "Enter your company website")
      .max(255)
      .refine((v) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v), "Enter a valid website"),
    companyLinkedin: linkedinField("company"),

    // Contact
    firstName: z.string().trim().min(1, "Enter your first name").max(80),
    lastName: z.string().trim().min(1, "Enter your last name").max(80),
    contactTitle: z.string().trim().max(120).optional().or(z.literal("")),
    workEmail: z.string().trim().toLowerCase().email("Enter a valid work email").max(255),
    phone: z.string().trim().min(6, "Enter a phone number we can reach you on").max(40),
    contactLinkedin: linkedinField("personal"),

    // Account
    // Optional: an already-authenticated client keeps their existing password.
    // When absent the server only accepts an email that already has an account.
    password: z
      .string()
      .min(MIN_ACCOUNT_PASSWORD, `Use at least ${MIN_ACCOUNT_PASSWORD} characters`)
      .max(128)
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().max(128).optional().or(z.literal("")),

    // ─── Step 1: the role ─────────────────────────────────────────────────
    roleTitle: z.string().trim().min(2, "Enter the job title").max(160),
    team: z.string().trim().max(160).optional().or(z.literal("")),
    jobDescriptionText: z.string().trim().max(60000).optional().or(z.literal("")),
    jobDescriptionFile: jdFileSchema.optional().nullable(),
    whyOpen: z
      .string()
      .trim()
      .min(MIN_WHY_OPEN, `Tell us in a sentence or two why this role is open (at least ${MIN_WHY_OPEN} characters)`)
      .max(2000),

    // ─── Step 2: who you need ─────────────────────────────────────────────
    mustHaves: z
      .string()
      .trim()
      .max(4000)
      .refine((v) => splitLines(v).length >= MIN_MUST_HAVES, {
        message: `List at least ${MIN_MUST_HAVES} must-haves, one per line`,
      }),
    niceToHaves: z.string().trim().max(4000).optional().or(z.literal("")),
    trainable: z.string().trim().max(4000).optional().or(z.literal("")),

    // ─── Step 3: practicalities ───────────────────────────────────────────
    // Optional on submit. The recruiting team can read most of this from the
    // JD; an empty answer marks the brief incomplete instead of blocking the
    // client at the door.
    location: z.string().trim().max(160).optional().or(z.literal("")),
    workModel: z.enum(WORK_MODELS).optional().or(z.literal("")),
    onsiteDays: z.coerce.number().int().min(0).max(7).optional(),

    currency: z.enum(COMP_CURRENCIES).default("USD"),
    compensationPeriod: z.enum(COMP_PERIODS).default("year"),
    salaryMin: z.coerce.number().min(1, "Enter the bottom of the range").optional(),
    salaryMax: z.coerce.number().min(1, "Enter the top of the range").optional(),
    compensationNote: z.string().trim().max(1000).optional().or(z.literal("")),

    workAuthorization: z.enum(WORK_AUTHORIZATION_VALUES).optional().or(z.literal("")),
    workAuthorizationNote: z.string().trim().max(1000).optional().or(z.literal("")),
    targetStartDate: z.string().trim().max(40).optional().or(z.literal("")),

    // ─── Step 4: process and confirm ──────────────────────────────────────
    interviewProcess: z.string().trim().max(2000).optional().or(z.literal("")),
    decisionMaker: z.string().trim().max(160).optional().or(z.literal("")),
    dealBreakers: z.string().trim().max(2000).optional().or(z.literal("")),

    consent: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
    pilotAcknowledgement: z.literal(true, {
      errorMap: () => ({ message: "Please confirm you understand how the pilot works" }),
    }),
    researchConsent: z.boolean().default(true),
    source: z.string().trim().max(80).default("express_onboarding"),
    // Silent spam trap — must stay empty.
    companyFax: z.string().max(200).optional().or(z.literal("")),
  })
  .refine((v) => (v.password ?? "") === (v.confirmPassword ?? ""), {
    path: ["confirmPassword"],
    message: "Both passwords must match",
  })
  .refine(
    (v) => (v.jobDescriptionText ?? "").trim().length >= MIN_JD_TEXT || !!v.jobDescriptionFile,
    {
      path: ["jobDescriptionText"],
      message: `Upload a job description file or paste at least ${MIN_JD_TEXT} characters`,
    },
  )
  // Compensation is optional, but half a range is worse than none: it looks
  // like a fact and is not one.
  .refine((v) => !(v.salaryMin && !v.salaryMax), {
    path: ["salaryMax"],
    message: "Add the top of the range too, or clear both",
  })
  .refine((v) => !(v.salaryMax && !v.salaryMin), {
    path: ["salaryMin"],
    message: "Add the bottom of the range too, or clear both",
  })
  .refine((v) => !(v.salaryMin && v.salaryMax) || Number(v.salaryMax) >= Number(v.salaryMin), {
    path: ["salaryMax"],
    message: "The top of the range must be at least the bottom",
  })
  .refine(
    (v) => !v.workModel || v.workModel === "remote" || typeof v.onsiteDays === "number",
    {
      path: ["onsiteDays"],
      message: "How many days on site each week?",
    },
  );



export type ExpressIntakeInput = z.infer<typeof expressIntakeSchema>;

export const EXPRESS_DRAFT_KEY = "taasflow.express.intake.v1";
export const EXPRESS_IDEMPOTENCY_KEY = "taasflow.express.intake.idem.v1";
export const EXPRESS_STEP_KEY = "taasflow.express.intake.step.v1";

/**
 * The four steps the client sees, with honest time estimates.
 *
 * Steps 1 and 2 are what sourcing cannot start without, so they gate submit.
 * Steps 3 and 4 can be finished later; until they are, the role carries a
 * visible "Brief incomplete" label rather than passing as finished.
 */
export const INTAKE_STEPS = [
  {
    key: "role",
    title: "The role",
    blurb: "What the job is and why it exists.",
    minutes: 3,
    required: true,
  },
  {
    key: "people",
    title: "Who you need",
    blurb: "What you would reject a great candidate for, and what you would teach.",
    minutes: 3,
    required: true,
  },
  {
    key: "practicalities",
    title: "Practicalities",
    blurb: "Money, place, authorisation, timing. Finish later if you need to.",
    minutes: 2,
    required: false,
  },
  {
    key: "process",
    title: "Process and confirm",
    blurb: "How you interview, who decides, and your details.",
    minutes: 2,
    required: false,
  },
] as const;

export type IntakeStepKey = (typeof INTAKE_STEPS)[number]["key"];

export const INTAKE_TOTAL_MINUTES = INTAKE_STEPS.reduce((sum, s) => sum + s.minutes, 0);

/** Which fields belong to which step, for step-scoped validation and focus. */
export const STEP_FIELDS: Record<IntakeStepKey, string[]> = {
  role: ["roleTitle", "team", "whyOpen", "jobDescriptionText"],
  people: ["mustHaves", "niceToHaves", "trainable"],
  practicalities: [
    "location",
    "workModel",
    "onsiteDays",
    "salaryMin",
    "salaryMax",
    "compensationNote",
    "workAuthorization",
    "workAuthorizationNote",
    "targetStartDate",
  ],
  process: [
    "interviewProcess",
    "decisionMaker",
    "dealBreakers",
    "companyName",
    "companyWebsite",
    "companyLinkedin",
    "firstName",
    "lastName",
    "contactTitle",
    "workEmail",
    "phone",
    "contactLinkedin",
    "password",
    "confirmPassword",
    "consent",
    "pilotAcknowledgement",
  ],
};

/**
 * Step-level validators for the two gating steps. Advancing past step 1 or 2
 * with an invalid required field is not allowed; steps 3 and 4 only validate
 * what was actually filled in, which the full schema already does.
 */
export const stepValidators = {
  role: z.object({
    roleTitle: z.string().trim().min(2, "Enter the job title").max(160),
    whyOpen: z
      .string()
      .trim()
      .min(MIN_WHY_OPEN, `Tell us in a sentence or two why this role is open (at least ${MIN_WHY_OPEN} characters)`)
      .max(2000),
  }),
  people: z.object({
    mustHaves: z
      .string()
      .trim()
      .refine((v) => splitLines(v).length >= MIN_MUST_HAVES, {
        message: `List at least ${MIN_MUST_HAVES} must-haves, one per line`,
      }),
  }),
} as const;

/** The answers that make a brief complete, in the words the client saw. */
export const BRIEF_COMPLETENESS_FIELDS: Array<{ field: string; label: string }> = [
  { field: "location", label: "Where the role is based" },
  { field: "workModel", label: "Remote, hybrid or on site" },
  { field: "salaryMin", label: "Compensation range" },
  { field: "workAuthorization", label: "Work authorisation" },
  { field: "interviewProcess", label: "How you interview" },
  { field: "decisionMaker", label: "Who makes the final decision" },
  { field: "dealBreakers", label: "What rules someone out" },
];

/**
 * What is still missing from a brief. Used by the wizard, the submit endpoint
 * and the role page, so the label never disagrees across surfaces.
 */
export function briefCompleteness(values: Record<string, unknown>): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  for (const { field, label } of BRIEF_COMPLETENESS_FIELDS) {
    const raw = values[field];
    const filled =
      typeof raw === "number"
        ? Number.isFinite(raw) && raw > 0
        : typeof raw === "string"
          ? raw.trim().length > 0
          : Boolean(raw);
    if (!filled) missing.push(label);
  }
  return { complete: missing.length === 0, missing };
}

export function jdFileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/** Blueprint preparation stages, in the order the client sees them. */
export const BLUEPRINT_STAGES = [
  { key: "queued", label: "Role created in your workspace" },
  { key: "analyzing_jd", label: "Reading your job description" },
  { key: "researching_company", label: "Reviewing your public company information" },
  { key: "drafting_blueprint", label: "Building the role blueprint and scoring rubric" },
  { key: "ready", label: "Blueprint ready for your review" },
] as const;

export type BlueprintStage = (typeof BLUEPRINT_STAGES)[number]["key"] | "not_started" | "failed";

export function blueprintProgress(status: string): number {
  const idx = BLUEPRINT_STAGES.findIndex((s) => s.key === status);
  if (status === "failed") return 100;
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / BLUEPRINT_STAGES.length) * 100);
}

