/**
 * The brief, whole, one screen before submit.
 *
 * Clients send us briefs with a stale must-have or last year's salary because
 * they answered step 1 four steps ago and never saw it again. This module turns
 * the form state into a review model: every answered field, grouped by the step
 * it came from, each row knowing which step and which control to send the
 * client back to.
 *
 * Two rules the UI depends on:
 *  - A field the client skipped produces no row. A summary full of "Not
 *    provided" reads like a list of accusations.
 *  - A missing REQUIRED field is never a silent gap: it goes in `missing`, is
 *    named at the top of the panel, and blocks submit.
 *
 * Pure — no React, no DOM, no form coupling beyond the snapshot type.
 */

export type IntakeReviewSnapshot = {
  // Role
  roleTitle: string;
  team: string;
  jobDescriptionText: string;
  jdFilename: string | null;
  // People
  requirements: Array<{ text: string; tag: string }>;
  // Practicalities
  location: string;
  workModelLabel: string;
  onsiteDays: string;
  remoteAnywhereInCountry: boolean;
  remoteTimezoneLabels: string[];
  sponsorshipLabel: string;
  compensationLine: string;
  workAuthorizationLabel: string;
  workAuthorizationNote: string;
  targetStartDate: string;
  // Process
  interviewStageLines: string[];
  interviewProcess: string;
  targetDaysToOffer: string;
  decisionMaker: string;
  decisionMakerEmail: string;
  dealBreakers: string[];
  // Company and contact
  companyName: string;
  companyWebsite: string;
  companyLinkedin: string;
  firstName: string;
  lastName: string;
  contactTitle: string;
  workEmail: string;
  phone: string;
  contactLinkedin: string;
  // Read from the job description or answered late — all optional, omitted when blank.
  seniority?: string;
  employmentType?: string;
  /** One readable line per interview stage: name, format and who runs it. */
  interviewStageDetails?: string[];
  /** e.g. "Invite the people named in the interview stages". Empty when not ticked. */
  collaboratorsLine?: string;
  /** Final-step acknowledgements, shown as answers rather than hidden ticks. */
  termsAccepted?: boolean;
  pilotAcknowledged?: boolean;
  researchConsent?: boolean;
  /** True once a password has been typed. The password itself is never shown. */
  passwordSet?: boolean;
};

export type IntakeReviewRow = {
  /** Form field key — used for focus and for matching the missing list. */
  field: string;
  /** What the client is looking at, in the words the form used. */
  label: string;
  /** The answer, already formatted for reading. */
  value: string;
  /** Zero-based step the row lives on. */
  step: number;
  /**
   * The visible label of the control to focus on return, when one exists.
   * Null for composite answers (requirement lists, uploads) where the step
   * itself is the right destination.
   */
  focusLabel: string | null;
};

export type IntakeReviewGroup = {
  step: number;
  title: string;
  rows: IntakeReviewRow[];
};

export type IntakeMissingField = {
  field: string;
  label: string;
  step: number;
  focusLabel: string | null;
};

export type IntakeReview = {
  groups: IntakeReviewGroup[];
  missing: IntakeMissingField[];
  answeredCount: number;
};

/** field → { label the client saw, step, control label to focus }. */
const FIELD_META: Record<string, { label: string; step: number; focusLabel: string | null }> = {
  roleTitle: { label: "Job title", step: 1, focusLabel: "Job title" },
  team: { label: "Team", step: 1, focusLabel: "Team" },
  jobDescriptionText: { label: "Job description", step: 0, focusLabel: null },
  requirements: { label: "What you need", step: 1, focusLabel: null },
  mustHaves: { label: "Must have", step: 1, focusLabel: null },
  niceToHaves: { label: "Nice to have", step: 1, focusLabel: null },
  trainable: { label: "Can be trained", step: 1, focusLabel: null },
  location: { label: "Where it is based", step: 2, focusLabel: "Where is the role based?" },
  workModel: { label: "How it works", step: 2, focusLabel: "How does it work?" },
  onsiteDays: { label: "Days on site", step: 2, focusLabel: "Days on site each week" },
  remoteTimezones: { label: "Remote boundary", step: 2, focusLabel: null },
  sponsorshipAvailable: { label: "Visa sponsorship", step: 2, focusLabel: null },
  salaryMin: { label: "Compensation", step: 2, focusLabel: "From" },
  workAuthorization: { label: "Work authorisation", step: 2, focusLabel: null },
  workAuthorizationNote: { label: "Authorisation note", step: 2, focusLabel: null },
  targetStartDate: { label: "Ideal start", step: 2, focusLabel: "Ideal start date" },
  interviewStages: { label: "Interview stages", step: 2, focusLabel: null },
  interviewProcess: { label: "Interview process", step: 2, focusLabel: null },
  targetDaysToOffer: {
    label: "Shortlist to offer",
    step: 2,
    focusLabel: "Target days from shortlist to offer",
  },
  decisionMaker: { label: "Final decision", step: 2, focusLabel: "Who makes the final decision?" },
  decisionMakerEmail: { label: "Decision maker email", step: 2, focusLabel: "Their email" },
  dealBreakerList: { label: "Rules someone out", step: 2, focusLabel: null },
  seniority: { label: "Seniority", step: 1, focusLabel: null },
  employmentType: { label: "Employment type", step: 1, focusLabel: null },
  collaborators: { label: "Interview team access", step: 2, focusLabel: null },
  termsSummary: { label: "Terms and privacy", step: 2, focusLabel: null },
  pilotSummary: { label: "Pilot acknowledgement", step: 2, focusLabel: null },
  researchSummary: { label: "Product research", step: 2, focusLabel: null },
  passwordSummary: { label: "Password", step: 0, focusLabel: "Password" },
  companyName: { label: "Company", step: 0, focusLabel: "Company name" },
  companyWebsite: { label: "Website", step: 1, focusLabel: "Company website" },
  companyLinkedin: { label: "Company LinkedIn", step: 0, focusLabel: "Company LinkedIn" },
  firstName: { label: "Name", step: 0, focusLabel: "First name" },
  lastName: { label: "Last name", step: 0, focusLabel: "Last name" },
  contactTitle: { label: "Your job title", step: 0, focusLabel: "Your job title" },
  workEmail: { label: "Work email", step: 0, focusLabel: "Work email" },
  phone: { label: "Phone", step: 0, focusLabel: "Phone" },
  contactLinkedin: { label: "Your LinkedIn", step: 0, focusLabel: "Your LinkedIn" },
  password: { label: "Password", step: 0, focusLabel: "Password" },
  confirmPassword: { label: "Confirm password", step: 0, focusLabel: "Confirm password" },
  consent: { label: "Terms and privacy", step: 0, focusLabel: null },
  pilotAcknowledgement: { label: "Pilot acknowledgement", step: 0, focusLabel: null },
};

/**
 * One title per wizard step, indexed by step number. These must stay aligned
 * with INTAKE_STEPS: the group's index is the step its Edit action jumps to, so
 * a stale extra title silently mislabels every group and sends "Edit the role"
 * to the wrong step.
 */
const GROUP_TITLES = ["You and the job description", "What we read", "Details and confirm"];

/** "full_time" -> "Full time". */
export function humanizeEnum(value: string): string {
  const v = (value ?? "").trim().replace(/[_-]+/g, " ");
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
}

/**
 * A salary range in words, for any combination the form can hold: both bounds,
 * only a minimum ("from"), or only a maximum ("up to"). The old line required
 * BOTH bounds, so a role with just a minimum showed no pay at all in the
 * review. Pure, locale-fixed so server and browser render the same text.
 */
export function formatCompensationRange(input: {
  currency: string;
  min: string;
  max: string;
  periodLabel: string;
}): string {
  const fmt = (v: string) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US") : "";
  };
  const min = fmt(input.min);
  const max = fmt(input.max);
  const cur = input.currency.trim();
  const period = input.periodLabel.trim();
  const tail = [period].filter(Boolean).join(" ");
  if (min && max) return [`${cur} ${min}–${max}`.trim(), tail].filter(Boolean).join(" ");
  if (min) return [`From ${cur} ${min}`.replace(/\s+/g, " ").trim(), tail].filter(Boolean).join(" ");
  if (max) return [`Up to ${cur} ${max}`.replace(/\s+/g, " ").trim(), tail].filter(Boolean).join(" ");
  return "";
}

/** "2026-09-01" -> "1 September 2026". Anything else is shown as typed. */
export function formatReviewDate(value: string): string {
  const v = (value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return v;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Every field the form holds is either shown in the review or deliberately left
 * out for a stated reason. A test compares this against the form's own state
 * type, so a new question cannot be added without the summary covering it.
 */
export const REVIEW_COVERAGE = {
  reviewed: [
    "companyName", "companyWebsite", "companyLinkedin", "firstName", "lastName", "contactTitle",
    "workEmail", "phone", "contactLinkedin", "password", "roleTitle", "team", "jobDescriptionText",
    "jdSourceName", "requirements", "mustHaves", "niceToHaves", "trainable", "dealBreakerList",
    "location", "workModel", "seniority", "employmentType", "onsiteDays", "remoteTimezones",
    "remoteAnywhereInCountry", "sponsorshipAvailable", "currency", "compensationPeriod",
    "salaryMin", "salaryMax", "compensationNote", "compensationUndecided", "bonusStructure",
    "equity", "compensationFlexible", "workAuthorizationNote", "interviewProcess",
    "interviewStages", "targetDaysToOffer", "inviteCollaborators", "decisionMaker",
    "decisionMakerEmail", "targetStartDate", "consent", "pilotAcknowledgement", "researchConsent",
  ],
  notReviewed: {
    confirmPassword: "Repeat of the password; the password row says it is set.",
    manyMustHavesConfirmed: "A confirmation about the must-have count, not an answer about the role.",
    dealBreakers: "Legacy single-string form of dealBreakerList, which is reviewed.",
    wideRangeConfirmed: "A confirmation about an unusually wide salary range, not an answer.",
    workAuthorization: "Derived from the visa sponsorship answer, which is reviewed.",
    companyFax: "Spam honeypot; never filled by a person.",
  },
} as const;

function row(field: string, value: string): IntakeReviewRow | null {
  const meta = FIELD_META[field];
  const clean = value.trim();
  // Skipped optional answers are omitted, never rendered as empty rows.
  if (!meta || !clean) return null;
  return { field, label: meta.label, value: clean, step: meta.step, focusLabel: meta.focusLabel };
}

export function buildIntakeReview(input: {
  snapshot: IntakeReviewSnapshot;
  /** field → required, from the same map the form and server validator use. */
  required: Record<string, boolean>;
  /** Fields already satisfied outside the text state (ticked boxes, files). */
  satisfied?: Record<string, boolean>;
}): IntakeReview {
  const s = input.snapshot;
  const tagged = (tag: string) =>
    s.requirements
      .filter((r) => r.tag === tag && r.text.trim())
      .map((r) => r.text.trim())
      .join(" · ");

  const remoteBoundary = [
    s.remoteAnywhereInCountry ? "Anywhere in the country" : "",
    s.remoteTimezoneLabels.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const candidates: Array<IntakeReviewRow | null> = [
    row("roleTitle", s.roleTitle),
    row("team", s.team),
    row("seniority", s.seniority ?? ""),
    row("employmentType", s.employmentType ?? ""),
    // The whole description, never a clipped preview: the client is being asked
    // to confirm it, and a cut-off paragraph cannot be confirmed. When it came
    // from a file the filename leads and the text read from it follows.
    row(
      "jobDescriptionText",
      [s.jdFilename, s.jobDescriptionText.trim()].filter(Boolean).join("\n\n"),
    ),
    row("mustHaves", tagged("must_have")),
    row("niceToHaves", tagged("nice_to_have")),
    row("trainable", tagged("trainable")),
    row("location", s.location),
    row("workModel", s.workModelLabel),
    row("onsiteDays", s.onsiteDays ? `${s.onsiteDays} days a week` : ""),
    row("remoteTimezones", remoteBoundary),
    row("sponsorshipAvailable", s.sponsorshipLabel),
    row("salaryMin", s.compensationLine),
    // workAuthorization is DERIVED from the sponsorship answer — the intake
    // form says so at the point it sets it: "the same answer in other words,
    // so it is derived rather than asked twice". Reviewing it as its own row
    // printed one answer under two names with identical values, which reads as
    // two separate commitments and pads the list a client is asked to check
    // carefully (audit 1 Sep, F31). The free-text NOTE is genuinely extra
    // information and stays.
    row("workAuthorizationNote", s.workAuthorizationNote),
    row("targetStartDate", formatReviewDate(s.targetStartDate)),
    row(
      "interviewStages",
      (s.interviewStageDetails && s.interviewStageDetails.length > 0
        ? s.interviewStageDetails
        : s.interviewStageLines
      ).join("\n"),
    ),
    row("interviewProcess", s.interviewProcess),
    row("targetDaysToOffer", s.targetDaysToOffer ? `${s.targetDaysToOffer} days` : ""),
    row("decisionMaker", s.decisionMaker),
    row("decisionMakerEmail", s.decisionMakerEmail),
    row("dealBreakerList", s.dealBreakers.join(" · ")),
    row("companyName", s.companyName),
    row("companyWebsite", s.companyWebsite),
    row("companyLinkedin", s.companyLinkedin),
    row("firstName", [s.firstName, s.lastName].filter(Boolean).join(" ")),
    row("contactTitle", s.contactTitle),
    row("workEmail", s.workEmail),
    row("phone", s.phone),
    row("contactLinkedin", s.contactLinkedin),
    row("passwordSummary", s.passwordSet ? "Set (not shown)" : ""),
    row("collaborators", s.collaboratorsLine ?? ""),
    row("termsSummary", s.termsAccepted ? "Accepted" : ""),
    row("pilotSummary", s.pilotAcknowledged ? "Acknowledged" : ""),
    row("researchSummary", s.researchConsent ? "You agreed to take part" : ""),
  ];

  const rows = candidates.filter((r): r is IntakeReviewRow => r !== null);
  const answered = new Set(rows.map((r) => r.field));
  // Name and surname share one row, so surname counts as answered with it.
  if (answered.has("firstName") && s.lastName.trim()) answered.add("lastName");
  if (s.requirements.some((r) => r.text.trim())) answered.add("requirements");

  const satisfied = input.satisfied ?? {};
  const missing: IntakeMissingField[] = [];
  for (const [field, isRequired] of Object.entries(input.required)) {
    if (!isRequired) continue;
    if (answered.has(field) || satisfied[field]) continue;
    const meta = FIELD_META[field];
    if (!meta) continue;
    missing.push({ field, label: meta.label, step: meta.step, focusLabel: meta.focusLabel });
  }
  missing.sort((a, b) => a.step - b.step);

  const groups: IntakeReviewGroup[] = GROUP_TITLES.map((title, step) => ({
    step,
    title,
    rows: rows.filter((r) => r.step === step),
  })).filter((g) => g.rows.length > 0);

  return { groups, missing, answeredCount: rows.length };
}
