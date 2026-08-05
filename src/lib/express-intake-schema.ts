import { z } from "zod";
import {
  MAX_DEAL_BREAKER_CHARS,
  normalizeDealBreakers,
  validateDealBreakers,
} from "@/lib/client-deal-breakers";

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
export const MIN_MUST_HAVES = 1;
/**
 * Above six must-haves a shortlist stops being a shortlist. We do not block
 * the client — we say so once and ask them to confirm or re-tag.
 */
export const MAX_MUST_HAVES = 6;
export const MIN_REQUIREMENT_CHARS = 3;
export const MAX_REQUIREMENT_CHARS = 120;
export const MAX_REQUIREMENTS = 30;
export const MIN_DEAL_BREAKERS = 20;
export const MIN_INTERVIEW_PROCESS = 20;

export const WORK_MODELS = ["remote", "hybrid", "onsite"] as const;
export const COMP_CURRENCIES = ["USD", "EUR", "GBP", "BRL", "CAD", "AUD"] as const;
export const COMP_PERIODS = ["year", "hour"] as const;

/** What the client says about equity. No inferred or benchmarked values. */
export const COMP_EQUITY = ["none", "offered", "negotiable"] as const;

export const COMP_EQUITY_LABELS: Record<(typeof COMP_EQUITY)[number], string> = {
  none: "No equity",
  offered: "Equity offered",
  negotiable: "Equity negotiable",
};

/**
 * A range wider than this share of the bottom of the range makes candidates
 * self-select out, so the client is asked to confirm it on purpose.
 */
export const COMPENSATION_WIDE_RANGE_RATIO = 0.6;

export const COMPENSATION_WIDE_RANGE_WARNING =
  "That range is wide — candidates will self-select out. Tick to confirm you meant it.";

/** The plain trade-off, stated once. No benchmark figures, ever. */
export const COMPENSATION_HONEST_LINE =
  "A stated range gets you to a first shortlist faster, and we screen candidates against it. We never publish it, and we do not show you market figures as fact.";

export function isWideCompensationRange(
  min: number | undefined | null,
  max: number | undefined | null,
): boolean {
  if (!min || !max || max < min) return false;
  return max - min > min * COMPENSATION_WIDE_RANGE_RATIO;
}

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

/**
 * Sponsorship is asked as an explicit yes or no, because it changes the
 * candidate pool more than anything else on this step. There is deliberately
 * no default: we do not guess, and we give no immigration advice.
 */
export const SPONSORSHIP_OPTIONS = [
  {
    value: "yes",
    label: "Yes — we can sponsor or transfer a visa",
    hint: "Widens the pool. We will still only shortlist people you can hire.",
  },
  {
    value: "no",
    label: "No — candidates must already be authorised to work here",
    hint: "Narrows the pool, and avoids a wasted shortlist.",
  },
] as const;

export const SPONSORSHIP_VALUES = ["yes", "no"] as const;

export const SPONSORSHIP_LABELS: Record<(typeof SPONSORSHIP_VALUES)[number], string> = {
  yes: "Sponsorship available",
  no: "Must already be authorised to work in this location",
};

/** Why the sponsorship answer is not optional, said in one line. */
export const SPONSORSHIP_WHY_IT_MATTERS =
  "This is the single biggest filter on who we can approach, so we ask it outright rather than assuming.";

/**
 * Acceptable timezone bands for remote roles. Broad working-hours bands, not
 * country lists — we never guess where somebody is allowed to work.
 */
export const TIMEZONE_BANDS = [
  { value: "americas_west", label: "Americas West (UTC−8 to UTC−6)" },
  { value: "americas_east", label: "Americas East (UTC−5 to UTC−3)" },
  { value: "uk_ireland", label: "UK and Ireland (UTC+0 to UTC+1)" },
  { value: "europe_central", label: "Europe Central (UTC+1 to UTC+3)" },
  { value: "middle_east_africa", label: "Middle East and Africa (UTC+2 to UTC+4)" },
  { value: "south_asia", label: "South Asia (UTC+5 to UTC+6)" },
  { value: "asia_pacific", label: "Asia Pacific (UTC+7 to UTC+9)" },
  { value: "oceania", label: "Australia and New Zealand (UTC+10 to UTC+13)" },
] as const;

export const TIMEZONE_BAND_VALUES = TIMEZONE_BANDS.map((t) => t.value) as unknown as [
  string,
  ...string[],
];

export const TIMEZONE_BAND_LABELS: Record<string, string> = Object.fromEntries(
  TIMEZONE_BANDS.map((t) => [t.value, t.label]),
);

export const WORK_MODEL_LABELS: Record<(typeof WORK_MODELS)[number], string> = {
  remote: "Fully remote",
  hybrid: "Hybrid",
  onsite: "On site",
};

export const COMP_PERIOD_LABELS: Record<(typeof COMP_PERIODS)[number], string> = {
  year: "per year",
  
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


/* ------------------------------------------------------------------ */
/* Requirements: one list, three tags                                  */
/* ------------------------------------------------------------------ */

export const REQUIREMENT_TAGS = ["must_have", "nice_to_have", "trainable"] as const;
export type RequirementTag = (typeof REQUIREMENT_TAGS)[number];

export const REQUIREMENT_TAG_LABELS: Record<RequirementTag, string> = {
  must_have: "Must have",
  nice_to_have: "Nice to have",
  trainable: "Can be trained",
};

/** Said on screen, so nobody has to guess what a tag does to sourcing. */
export const REQUIREMENT_TAG_EFFECTS: Record<RequirementTag, string> = {
  must_have: "Filters the shortlist and drives the evidence bullets you read.",
  nice_to_have: "Orders the shortlist. Never rules anyone out.",
  trainable: "Excluded from filtering entirely. We simply note you would teach it.",
};

export const requirementSchema = z.object({
  text: z
    .string()
    .trim()
    .min(MIN_REQUIREMENT_CHARS, `Use at least ${MIN_REQUIREMENT_CHARS} characters`)
    .max(MAX_REQUIREMENT_CHARS, `Keep it under ${MAX_REQUIREMENT_CHARS} characters`),
  tag: z.enum(REQUIREMENT_TAGS),
});

export type RequirementItem = z.infer<typeof requirementSchema>;

export function normalizeRequirementKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function countMustHaves(items: Array<{ text: string; tag: RequirementTag }>): number {
  return items.filter((i) => i.tag === "must_have" && i.text.trim().length > 0).length;
}

/**
 * Validates the whole requirements list in the order the client arranged it.
 * Returns per-row messages plus a single list-level message, so the UI can put
 * every error under the thing it is about.
 */
export function validateRequirements(
  items: Array<{ text: string; tag: RequirementTag }>,
  opts: { manyConfirmed?: boolean } = {},
): { ok: boolean; rowErrors: Record<number, string>; listError: string | null; needsConfirm: boolean } {
  const rowErrors: Record<number, string> = {};
  const seen = new Map<string, number>();
  items.forEach((item, i) => {
    const text = item.text.trim();
    if (text.length === 0) {
      rowErrors[i] = "Write the requirement, or remove the row";
      return;
    }
    if (text.length < MIN_REQUIREMENT_CHARS) {
      rowErrors[i] = `Use at least ${MIN_REQUIREMENT_CHARS} characters`;
      return;
    }
    if (text.length > MAX_REQUIREMENT_CHARS) {
      rowErrors[i] = `Keep it under ${MAX_REQUIREMENT_CHARS} characters`;
      return;
    }
    const key = normalizeRequirementKey(text);
    if (seen.has(key)) {
      rowErrors[i] = "You already listed this one";
      return;
    }
    seen.set(key, i);
  });

  const mustHaves = countMustHaves(items);
  let listError: string | null = null;
  let needsConfirm = false;
  if (mustHaves < MIN_MUST_HAVES) {
    listError = "Tag at least one requirement as a must have";
  } else if (mustHaves > MAX_MUST_HAVES) {
    needsConfirm = !opts.manyConfirmed;
    if (needsConfirm) {
      listError = `${MAX_MUST_HAVES} or fewer must-haves gets you a shortlist faster. Re-tag a few, or confirm you want all ${mustHaves}.`;
    }
  }

  return {
    ok: Object.keys(rowErrors).length === 0 && !listError,
    rowErrors,
    listError,
    needsConfirm,
  };
}

/** The three legacy lines-per-field strings, derived from the tagged list. */
export function requirementsToLines(items: Array<{ text: string; tag: RequirementTag }>): {
  mustHaves: string;
  niceToHaves: string;
  trainable: string;
} {
  const pick = (tag: RequirementTag) =>
    items
      .filter((i) => i.tag === tag && i.text.trim().length > 0)
      .map((i) => i.text.trim())
      .join("\n");
  return {
    mustHaves: pick("must_have"),
    niceToHaves: pick("nice_to_have"),
    trainable: pick("trainable"),
  };
}

/** Rebuilds a tagged list from a saved draft that only had the three strings. */
export function linesToRequirements(values: {
  mustHaves?: string | null;
  niceToHaves?: string | null;
  trainable?: string | null;
}): RequirementItem[] {
  const out: RequirementItem[] = [];
  const add = (raw: string | null | undefined, tag: RequirementTag) => {
    for (const text of splitLines(raw)) out.push({ text, tag });
  };
  add(values.mustHaves, "must_have");
  add(values.niceToHaves, "nice_to_have");
  add(values.trainable, "trainable");
  return out;
}

/** Three worked examples for an empty list, shaped by the job title entered. */
export function requirementExamples(roleTitle: string): RequirementItem[] {
  const title = (roleTitle ?? "").trim();
  const role = title.length > 0 ? title : "this role";
  return [
    { text: `Has done ${role} work for at least three years`, tag: "must_have" },
    { text: "Has owned a budget or a team, not just contributed", tag: "nice_to_have" },
    { text: "Our internal systems and reporting tools", tag: "trainable" },
  ];
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

/* ------------------------------------------------------------------ */
/* Interview process: stages, owners, and a target time to offer        */
/* ------------------------------------------------------------------ */

export const MIN_INTERVIEW_STAGES = 1;
export const MAX_INTERVIEW_STAGES = 5;
export const MIN_STAGE_NAME_CHARS = 2;
export const MAX_STAGE_NAME_CHARS = 60;
export const MIN_TARGET_DAYS_TO_OFFER = 1;
export const MAX_TARGET_DAYS_TO_OFFER = 90;

export const INTERVIEW_STAGE_FORMATS = [
  "phone_screen",
  "video_call",
  "panel",
  "onsite",
  "take_home",
  "other",
] as const;

export type InterviewStageFormat = (typeof INTERVIEW_STAGE_FORMATS)[number];

export const INTERVIEW_STAGE_FORMAT_LABELS: Record<InterviewStageFormat, string> = {
  phone_screen: "Phone screen",
  video_call: "Video call",
  panel: "Panel",
  onsite: "On site",
  take_home: "Take-home or task",
  other: "Other",
};

export const interviewStageSchema = z.object({
  name: z.string().trim().min(MIN_STAGE_NAME_CHARS).max(MAX_STAGE_NAME_CHARS),
  format: z.enum(INTERVIEW_STAGE_FORMATS),
  ownerName: z.string().trim().max(120).optional().or(z.literal("")),
  ownerEmail: z.string().trim().max(255).optional().or(z.literal("")),
});

export type InterviewStage = z.infer<typeof interviewStageSchema>;

/**
 * A suggestion, never a submitted default. The client accepts it, edits it, or
 * replaces it — the form starts with an empty list until they choose.
 */
export const DEFAULT_INTERVIEW_STAGE_TEMPLATE: InterviewStage[] = [
  { name: "Intro call", format: "video_call", ownerName: "", ownerEmail: "" },
  { name: "Hiring manager interview", format: "video_call", ownerName: "", ownerEmail: "" },
  { name: "Final panel", format: "panel", ownerName: "", ownerEmail: "" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidOwnerEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Why we ask, said once, in the client's terms. */
export const INTERVIEW_PROCESS_WHY_IT_MATTERS =
  "Scheduling stalls at the first shortlist when nobody knows how many rounds there are or who decides. Tell us once and we work around your people.";

export const COLLABORATOR_OPT_IN_LABEL =
  "Invite the people above to this workspace after the role is accepted. Nothing is sent unless you tick this.";

export type InterviewStageIssues = { name?: string; format?: string; ownerEmail?: string };

/**
 * Stage-list rules, in one place so the wizard, the step check and the submit
 * endpoint can never disagree about what a valid process looks like.
 */
export function validateInterviewStages(
  stages: InterviewStage[],
  opts: { targetDaysToOffer?: number | null } = {},
): { ok: boolean; rowErrors: Record<number, InterviewStageIssues>; listError?: string; targetError?: string } {
  const rowErrors: Record<number, InterviewStageIssues> = {};
  let listError: string | undefined;
  let targetError: string | undefined;

  const filled = stages.filter(
    (s) => (s.name ?? "").trim().length > 0 || (s.ownerName ?? "").trim().length > 0 || (s.ownerEmail ?? "").trim().length > 0,
  );
  if (filled.length < MIN_INTERVIEW_STAGES) {
    listError = "Add at least one interview stage";
  }
  if (stages.length > MAX_INTERVIEW_STAGES) {
    listError = `Keep it to ${MAX_INTERVIEW_STAGES} stages or fewer`;
  }

  const seen = new Map<string, number>();
  stages.forEach((stage, i) => {
    const issues: InterviewStageIssues = {};
    const name = (stage.name ?? "").trim();
    if (name.length < MIN_STAGE_NAME_CHARS) {
      issues.name = `Name this stage (${MIN_STAGE_NAME_CHARS}–${MAX_STAGE_NAME_CHARS} characters)`;
    } else if (name.length > MAX_STAGE_NAME_CHARS) {
      issues.name = `Keep the stage name under ${MAX_STAGE_NAME_CHARS} characters`;
    } else {
      const key = name.toLowerCase();
      if (seen.has(key)) issues.name = "Two stages cannot share the same name";
      else seen.set(key, i);
    }
    if (!stage.format) issues.format = "Pick a format";
    const email = (stage.ownerEmail ?? "").trim();
    if (email.length > 0 && !isValidOwnerEmail(email)) {
      issues.ownerEmail = "Enter a valid email address";
    }
    if (Object.keys(issues).length > 0) rowErrors[i] = issues;
  });

  const days = opts.targetDaysToOffer;
  if (days !== undefined && days !== null && Number.isFinite(days)) {
    if (days < MIN_TARGET_DAYS_TO_OFFER || days > MAX_TARGET_DAYS_TO_OFFER) {
      targetError = `Between ${MIN_TARGET_DAYS_TO_OFFER} and ${MAX_TARGET_DAYS_TO_OFFER} days`;
    }
  }

  return {
    ok: !listError && !targetError && Object.keys(rowErrors).length === 0,
    rowErrors,
    listError,
    targetError,
  };
}

/** The stages as one readable line per stage, for surfaces that read text. */
export function interviewProcessSummary(
  stages: InterviewStage[],
  targetDaysToOffer?: number | null,
): string {
  const lines = stages
    .filter((s) => (s.name ?? "").trim().length > 0)
    .map((s, i) => {
      const owner = [(s.ownerName ?? "").trim(), (s.ownerEmail ?? "").trim()]
        .filter(Boolean)
        .join(", ");
      const format = INTERVIEW_STAGE_FORMAT_LABELS[s.format] ?? s.format;
      return `${i + 1}. ${s.name.trim()} — ${format}${owner ? ` (${owner})` : ""}`;
    });
  if (targetDaysToOffer && Number.isFinite(targetDaysToOffer)) {
    lines.push(`Target: shortlist to offer in ${targetDaysToOffer} days`);
  }
  return lines.join("\n");
}

/** Owners the client entered, de-duplicated by email. Never contacted here. */
export function collaboratorCandidates(
  stages: InterviewStage[],
  extra: { name?: string; email?: string } = {},
): Array<{ name: string; email: string }> {
  const out = new Map<string, { name: string; email: string }>();
  const add = (name: string, email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean || !isValidOwnerEmail(clean)) return;
    if (!out.has(clean)) out.set(clean, { name: name.trim(), email: clean });
  };
  for (const s of stages) add(s.ownerName ?? "", s.ownerEmail ?? "");
  add(extra.name ?? "", extra.email ?? "");
  return Array.from(out.values());
}



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
    phone: z.string().trim().max(40).optional().or(z.literal("")),
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
    /**
     * The tagged list exactly as the client ordered it. The three strings above
     * stay in the payload because everything downstream already reads them;
     * this carries the order and the tag so neither is lost.
     */
    requirements: z.array(requirementSchema).max(MAX_REQUIREMENTS).optional().default([]),
    manyMustHavesConfirmed: z.boolean().optional().default(false),

    // ─── Step 3: practicalities ───────────────────────────────────────────
    // Optional on submit. The recruiting team can read most of this from the
    // JD; an empty answer marks the brief incomplete instead of blocking the
    // client at the door.
    location: z.string().trim().max(160).optional().or(z.literal("")),
    workModel: z.enum(WORK_MODELS).optional().or(z.literal("")),
    onsiteDays: z.coerce.number().int().min(0).max(7).optional(),
    /** Remote only: acceptable working-hours bands. */
    remoteTimezones: z.array(z.enum(TIMEZONE_BAND_VALUES)).max(8).optional().default([]),
    /** Remote only: "anywhere in the country", stated explicitly. */
    remoteAnywhereInCountry: z.boolean().optional().default(false),

    currency: z.enum(COMP_CURRENCIES).default("USD"),
    compensationPeriod: z.enum(COMP_PERIODS).default("year"),
    salaryMin: z.coerce.number().min(1, "Enter the bottom of the range").optional(),
    salaryMax: z.coerce.number().min(1, "Enter the top of the range").optional(),
    compensationNote: z.string().trim().max(1000).optional().or(z.literal("")),
    /** "Not decided yet" — recorded as undecided, never as zero. */
    compensationUndecided: z.boolean().optional().default(false),
    bonusStructure: z.string().trim().max(500).optional().or(z.literal("")),
    equity: z.enum(COMP_EQUITY).optional().or(z.literal("")),
    /** "Flexible for the right person" — stated by the client, not inferred. */
    compensationFlexible: z.boolean().optional().default(false),
    /** Set when the client confirms a range wider than the stated threshold. */
    wideRangeConfirmed: z.boolean().optional().default(false),

    workAuthorization: z.enum(WORK_AUTHORIZATION_VALUES).optional().or(z.literal("")),
    /**
     * Always answered. No default — an unanswered sponsorship question is a
     * validation error, not a silent "yes".
     */
    sponsorshipAvailable: z.enum(SPONSORSHIP_VALUES, {
      errorMap: () => ({ message: "Answer yes or no — we do not assume either way" }),
    }),
    workAuthorizationNote: z.string().trim().max(1000).optional().or(z.literal("")),
    targetStartDate: z.string().trim().max(40).optional().or(z.literal("")),

    // ─── Step 4: process and confirm ──────────────────────────────────────
    interviewProcess: z.string().trim().max(2000).optional().or(z.literal("")),
    /** The structured process: one to five named stages, each with an owner. */
    interviewStages: z.preprocess(
      // An empty or missing value means "no process stated", not an error.
      (v) => (Array.isArray(v) ? v : []),
      z.array(interviewStageSchema).max(MAX_INTERVIEW_STAGES),
    ),

    targetDaysToOffer: z.preprocess(
      // Blank means "not stated", which is allowed on this optional step.
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce
        .number()
        .int()
        .min(MIN_TARGET_DAYS_TO_OFFER)
        .max(MAX_TARGET_DAYS_TO_OFFER)
        .optional(),
    ),

    decisionMaker: z.string().trim().max(160).optional().or(z.literal("")),
    decisionMakerEmail: z
      .string()
      .trim()
      .max(255)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || isValidOwnerEmail(v), "Enter a valid email address"),
    /**
     * Explicit opt-in. Owners entered at intake are never emailed unless this
     * is true, and nothing is sent from the intake itself.
     */
    // Anything other than an explicit true means no invitations are sent.
    inviteCollaborators: z.preprocess((v) => v === true, z.boolean()),


    /** Legacy free text. Derived from the list below when the client sends one. */
    dealBreakers: z.string().trim().max(2000).optional().or(z.literal("")),
    /** Up to five short lines. Optional — an empty list is a valid answer. */
    dealBreakerList: z.preprocess(
      (v) => (Array.isArray(v) ? v : []),
      z.array(z.string().trim().max(MAX_DEAL_BREAKER_CHARS + 40)).max(20),
    ),


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
  .refine(
    (v) => {
      const items = v.requirements ?? [];
      if (items.length === 0) return true; // legacy payloads validated by mustHaves
      return validateRequirements(items, { manyConfirmed: v.manyMustHavesConfirmed }).ok;
    },
    {
      path: ["requirements"],
      message: "Check your requirements list",
    },
  )
  // The stage list is optional, but a half-built one is worse than none: it
  // looks like an agreed process and is not one.
  .refine(
    (v) => {
      const stages = v.interviewStages ?? [];
      if (stages.length === 0) return true;
      return validateInterviewStages(stages, { targetDaysToOffer: v.targetDaysToOffer ?? null }).ok;
    },
    {
      path: ["interviewStages"],
      message: "Check your interview stages",
    },
  )

  // Deal-breakers are optional, but a half-typed line is not a rule.
  .refine((v) => validateDealBreakers(v.dealBreakerList ?? []).ok, {
    path: ["dealBreakerList"],
    message: "Check your deal-breakers",
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
  // "Not decided yet" is a real answer, not a zero. It cannot coexist with a
  // range, or the brief would carry two different truths.
  .refine((v) => !(v.compensationUndecided && (v.salaryMin || v.salaryMax)), {
    path: ["compensationUndecided"],
    message: "Clear the range, or untick 'Not decided yet'",
  })
  // A very wide range still goes through — but only once the client says so.
  .refine(
    (v) => !isWideCompensationRange(v.salaryMin, v.salaryMax) || v.wideRangeConfirmed === true,
    {
      path: ["wideRangeConfirmed"],
      message: COMPENSATION_WIDE_RANGE_WARNING,
    },
  )
  // Hybrid is the only model that needs a day count, and it must be 1–5.
  .refine((v) => v.workModel !== "hybrid" || typeof v.onsiteDays === "number", {
    path: ["onsiteDays"],
    message: "How many days on site each week?",
  })
  .refine(
    (v) =>
      v.workModel !== "hybrid" ||
      typeof v.onsiteDays !== "number" ||
      (v.onsiteDays >= 1 && v.onsiteDays <= 5),
    {
      path: ["onsiteDays"],
      message: "Between 1 and 5 days a week",
    },
  )
  // Hybrid and on-site both need somewhere to be.
  .refine(
    (v) => (v.workModel !== "hybrid" && v.workModel !== "onsite") || Boolean(v.location?.trim()),
    {
      path: ["location"],
      message: "Which city and country is this based in?",
    },
  )
  // Remote needs a boundary: timezone bands, or an explicit anywhere-in-country.
  .refine(
    (v) =>
      v.workModel !== "remote" ||
      (v.remoteTimezones?.length ?? 0) > 0 ||
      v.remoteAnywhereInCountry === true,
    {
      path: ["remoteTimezones"],
      message: "Pick at least one acceptable timezone, or say anywhere in the country",
    },
  )
  /**
   * Fields that are hidden for the chosen work model never submit a stale
   * value from an earlier selection.
   */
  .transform((v) => ({
    ...v,
    onsiteDays: v.workModel === "hybrid" ? v.onsiteDays : undefined,
    remoteTimezones: v.workModel === "remote" ? (v.remoteTimezones ?? []) : [],
    remoteAnywhereInCountry: v.workModel === "remote" ? v.remoteAnywhereInCountry === true : false,
  }));



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
    key: "company",
    title: "You and your company",
    blurb: "Who you are and where you work, then your account so nothing is lost.",
    minutes: 2,
    required: true,
  },
  {
    key: "role",
    title: "The role",
    blurb: "What the job is, why it exists, and what a candidate must have.",
    minutes: 3,
    required: true,
  },
  {
    key: "details",
    title: "Details and confirm",
    blurb: "Money, place, timing and process. Optional now — finish later if you prefer.",
    minutes: 2,
    required: false,
  },
] as const;

export type IntakeStepKey = (typeof INTAKE_STEPS)[number]["key"];

export const INTAKE_TOTAL_MINUTES = INTAKE_STEPS.reduce((sum, s) => sum + s.minutes, 0);

/** Which fields belong to which step, for step-scoped validation and focus. */
export const STEP_FIELDS: Record<IntakeStepKey, string[]> = {
  company: [
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
  role: [
    "roleTitle",
    "team",
    "whyOpen",
    "jobDescriptionText",
    "requirements",
    "mustHaves",
    "niceToHaves",
    "trainable",
  ],
  details: [
    "location",
    "workModel",
    "onsiteDays",
    "remoteTimezones",
    "remoteAnywhereInCountry",
    "sponsorshipAvailable",
    "salaryMin",
    "salaryMax",
    "compensationNote",
    "compensationUndecided",
    "bonusStructure",
    "equity",
    "compensationFlexible",
    "wideRangeConfirmed",
    "workAuthorization",
    "workAuthorizationNote",
    "targetStartDate",
    "interviewProcess",
    "interviewStages",
    "targetDaysToOffer",
    "decisionMakerEmail",
    "inviteCollaborators",
    "decisionMaker",
    "dealBreakers",
    "dealBreakerList",
  ],
};

/**
 * Step-level validators for the two gating steps. Advancing past step 1 or 2
 * with an invalid required field is not allowed; step 3 only validates what
 * was actually filled in, which the full schema already does.
 */
export const stepValidators = {
  company: z.object({
    companyName: z.string().trim().min(2, "Enter your company name").max(200),
    companyWebsite: z.string().trim().min(3, "Enter your company website").max(300),
    firstName: z.string().trim().min(1, "Enter your first name").max(100),
    lastName: z.string().trim().min(1, "Enter your last name").max(100),
    workEmail: z.string().trim().email("Enter a valid work email"),
  }),
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
        message: "Tag at least one requirement as a must have",
      }),
  }),
} as const;


/* ------------------------------------------------------------------ */
/* Requiredness: one source of truth for the form and the server        */
/* ------------------------------------------------------------------ */

/**
 * Fields the server refuses to accept empty, no matter the context.
 * The form reads this same list, so a field can never be required on the
 * server and quietly optional on screen.
 */
export const ALWAYS_REQUIRED_INTAKE_FIELDS = [
  "companyName",
  "companyWebsite",
  "firstName",
  "lastName",
  "workEmail",
  "roleTitle",
  "whyOpen",
  "requirements",
  "sponsorshipAvailable",
  "consent",
  "pilotAcknowledgement",
] as const;

/**
 * Fields that become required because of something the client already chose.
 * Stated up front, never turned on after a failed submit.
 */
export type IntakeRequirednessContext = {
  /** A job description file removes the "paste the text" requirement. */
  hasJdFile?: boolean;
  /** Signed-in clients keep their existing password. */
  authed?: boolean;
  /** Signing in needs a password; confirming one does not apply. */
  signInMode?: boolean;
  /** Anything other than fully remote needs a day count. */
  workModel?: string;
  /** "Anywhere in the country" removes the timezone requirement. */
  remoteAnywhereInCountry?: boolean;
};

/** Every intake field name mapped to whether it is required right now. */
export function intakeRequiredness(
  ctx: IntakeRequirednessContext = {},
): Record<string, boolean> {
  const map: Record<string, boolean> = {
    // Optional across the board — declared explicitly so the form never has
    // to guess, and so a new field cannot slip through undecorated.
    companyLinkedin: false,
    phone: false,
    // Lives on the optional details step, so it cannot be always-required.
    sponsorshipAvailable: false,
    contactTitle: false,
    contactLinkedin: false,
    team: false,
    location: false,
    workModel: false,
    salaryMin: false,
    salaryMax: false,
    compensationNote: false,
    compensationUndecided: false,
    bonusStructure: false,
    equity: false,
    compensationFlexible: false,
    wideRangeConfirmed: false,
    workAuthorization: false,
    workAuthorizationNote: false,
    targetStartDate: false,
    remoteAnywhereInCountry: false,
    interviewProcess: false,
    interviewStages: false,
    targetDaysToOffer: false,
    decisionMakerEmail: false,
    inviteCollaborators: false,
    decisionMaker: false,

    dealBreakers: false,
    dealBreakerList: false,
    researchConsent: false,
  };
  for (const field of ALWAYS_REQUIRED_INTAKE_FIELDS) map[field] = true;

  map["jobDescriptionText"] = !ctx.hasJdFile;
  map["password"] = !ctx.authed;
  map["confirmPassword"] = !ctx.authed && !ctx.signInMode;
  // Only hybrid asks for a day count; on site is by definition full weeks.
  map["onsiteDays"] = ctx.workModel === "hybrid";
  // Hybrid and on-site roles need a place; remote roles need a boundary.
  map["location"] = ctx.workModel === "hybrid" || ctx.workModel === "onsite";
  map["remoteTimezones"] = ctx.workModel === "remote" && !ctx.remoteAnywhereInCountry;
  return map;
}

/** Said once per step, so nobody has to infer it from the styling. */
export const INTAKE_REQUIRED_LEGEND =
  "Fields marked * are required. Everything else is marked Optional.";


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
  /**
   * A remote role bounded by timezones or an explicit "anywhere in the country"
   * counts as answered, even without a city.
   */
  const remoteBounded =
    values["workModel"] === "remote" &&
    (Array.isArray(values["remoteTimezones"]) && values["remoteTimezones"].length > 0
      ? true
      : values["remoteAnywhereInCountry"] === true);
  /** A named list answers "what rules someone out" as well as free text does. */
  const hasDealBreakers = normalizeDealBreakers(values["dealBreakerList"]).length > 0;
  /** A named stage list answers "how you interview" as well as free text does. */
  const hasStages =
    Array.isArray(values["interviewStages"]) &&
    (values["interviewStages"] as unknown[]).some(
      (s) => typeof (s as { name?: string })?.name === "string" && (s as { name: string }).name.trim().length > 0,
    );
  for (const { field, label } of BRIEF_COMPLETENESS_FIELDS) {
    const raw = values[field];
    const filled =
      field === "location" && remoteBounded
        ? true
        : field === "interviewProcess" && hasStages
          ? true
        : field === "dealBreakers" && hasDealBreakers
          ? true
          : typeof raw === "number"
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

