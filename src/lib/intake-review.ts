/**
 * The brief, whole, one screen before submit.
 *
 * Clients send us briefs with a stale must-have or last year's salary because
 * they answered step 1 four steps ago and never saw it again. This module turns
 * the form state into a review model: every answered field, grouped by topic
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

import { COMP_PERIOD_LABELS, COMP_EQUITY_LABELS, INTERVIEW_STAGE_FORMAT_LABELS, type InterviewStage } from "@/lib/express-intake-schema";
import { APP_LOCALE } from "@/lib/format/datetime";
import { formatEnumLabel } from "@/lib/human-labels";

export type IntakeReviewCompensation = {
  salaryMin: string;
  salaryMax: string;
  currency: string;
  period: string;
  undecided: boolean;
  bonus: string;
  equity: string;
  flexible: boolean;
  note: string;
};

export type IntakeReviewSnapshot = {
  // Role
  roleTitle: string;
  team: string;
  seniority?: string;
  employmentType?: string;
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
  compensation?: IntakeReviewCompensation;
  workAuthorizationLabel: string;
  workAuthorizationNote: string;
  targetStartDate: string;
  // Process
  interviewStageLines: string[];
  interviewStages?: InterviewStage[];
  collaborators?: Array<{ name: string; email: string }>;
  inviteCollaborators?: boolean;
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
};

export type IntakeReviewRow = {
  /** Form field key — used for focus and for matching the missing list. */
  field: string;
  /** What the client is looking at, in the words the form used. */
  label: string;
  /** The answer, already formatted for reading. */
  value: string;
  items?: string[];
  stages?: Array<{ name: string; format: string; owner: string }>;
  fullWidth?: boolean;
  editable?: boolean;
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
  id: string;
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
  headline: string;
};

/** field → { label the client saw, step, control label to focus }. */
const FIELD_META: Record<string, { label: string; step: number; focusLabel: string | null }> = {
  roleTitle: { label: "Job title", step: 1, focusLabel: "Job title" },
  team: { label: "Team", step: 1, focusLabel: "Team" },
  seniority: { label: "Seniority", step: 0, focusLabel: "Job description" },
  employmentType: { label: "Employment type", step: 0, focusLabel: "Job description" },
  jdFilename: { label: "Attached job description", step: 0, focusLabel: "Job description" },
  jobDescriptionText: { label: "Job description", step: 0, focusLabel: "Job description" },
  requirements: { label: "Must-have requirements", step: 1, focusLabel: "Requirements" },
  mustHaves: { label: "Must have", step: 1, focusLabel: "Requirements" },
  niceToHaves: { label: "Nice to have", step: 1, focusLabel: "Requirements" },
  trainable: { label: "Can be trained", step: 1, focusLabel: "Requirements" },
  location: { label: "Where it is based", step: 2, focusLabel: "Where is the role based?" },
  workModel: { label: "How it works", step: 2, focusLabel: "How does it work?" },
  onsiteDays: { label: "Days on site", step: 2, focusLabel: "Days on site each week" },
  remoteTimezones: { label: "Remote boundary", step: 2, focusLabel: "remoteTimezones" },
  sponsorshipAvailable: { label: "Visa sponsorship", step: 2, focusLabel: "sponsorshipAvailable" },
  salaryMin: { label: "Compensation", step: 2, focusLabel: "From" },
  salaryMax: { label: "Compensation", step: 2, focusLabel: "To" },
  compensationUndecided: { label: "Compensation", step: 2, focusLabel: "compensationUndecided" },
  bonusStructure: { label: "Bonus", step: 2, focusLabel: "Bonus" },
  equity: { label: "Equity", step: 2, focusLabel: "Equity" },
  compensationFlexible: { label: "Flexibility", step: 2, focusLabel: "compensationFlexible" },
  compensationNote: { label: "Anything else about the package", step: 2, focusLabel: "Anything else about the package" },
  workAuthorization: { label: "Work authorisation", step: 2, focusLabel: "sponsorshipAvailable" },
  workAuthorizationNote: { label: "Authorisation note", step: 2, focusLabel: "Authorisation note" },
  targetStartDate: { label: "Ideal start", step: 2, focusLabel: "When would you like them to start?" },
  interviewStages: { label: "Interview stages", step: 2, focusLabel: "interviewStages" },
  interviewProcess: { label: "Interview process", step: 2, focusLabel: "Additional interview details" },
  inviteCollaborators: { label: "Collaborator invitations", step: 2, focusLabel: "inviteCollaborators" },
  targetDaysToOffer: {
    label: "Shortlist to offer",
    step: 2,
    focusLabel: "Target days from shortlist to offer",
  },
  decisionMaker: { label: "Final decision", step: 2, focusLabel: "Who makes the final decision?" },
  decisionMakerEmail: { label: "Decision maker email", step: 2, focusLabel: "Their email" },
  dealBreakerList: { label: "Disqualifiers", step: 2, focusLabel: "dealBreakerList" },
  companyName: { label: "Company", step: 0, focusLabel: "Company name" },
  companyWebsite: { label: "Website", step: 1, focusLabel: "Company website" },
  companyLinkedin: { label: "Company LinkedIn", step: 0, focusLabel: "Company LinkedIn" },
  firstName: { label: "First name", step: 0, focusLabel: "First name" },
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

/** Topics are independent of navigation; each row retains its actual step. */
const SECTIONS = [
  { id: "company", title: "Company and hiring contact", fields: ["companyName", "companyWebsite", "companyLinkedin", "firstName", "contactTitle", "workEmail", "phone", "contactLinkedin"] },
  { id: "role", title: "Role overview", fields: ["roleTitle", "team", "seniority", "employmentType", "jdFilename", "jobDescriptionText"] },
  { id: "requirements", title: "Candidate requirements", fields: ["mustHaves", "niceToHaves", "trainable", "dealBreakerList"] },
  { id: "practicalities", title: "Location & practicalities", fields: ["workModel", "location", "onsiteDays", "remoteTimezones", "sponsorshipAvailable", "workAuthorization", "workAuthorizationNote", "targetStartDate"] },
  { id: "compensation", title: "Compensation", fields: ["compensationUndecided", "salaryMin", "salaryMax", "bonusStructure", "equity", "compensationFlexible", "compensationNote"] },
  { id: "workflow", title: "Hiring workflow", fields: ["interviewStages", "interviewProcess", "targetDaysToOffer", "decisionMaker", "decisionMakerEmail", "inviteCollaborators"] },
];

function row(field: string, value: string, extra: Partial<IntakeReviewRow> = {}): IntakeReviewRow | null {
  const meta = FIELD_META[field];
  const clean = value.trim();
  // Skipped optional answers are omitted, never rendered as empty rows.
  if (!meta || !clean) return null;
  return { field, label: meta.label, value, step: meta.step, focusLabel: meta.focusLabel, ...extra };
}

export function reviewCompensationRows(c: IntakeReviewCompensation): Array<IntakeReviewRow | null> {
  const amount = (raw: string) => {
    if (!raw.trim()) return "";
    const n = Number(raw);
    return Number.isFinite(n) ? n.toLocaleString(APP_LOCALE) : raw;
  };
  const min = amount(c.salaryMin);
  const max = amount(c.salaryMax);
  const period = COMP_PERIOD_LABELS[c.period as keyof typeof COMP_PERIOD_LABELS] ?? "";
  const range = min && max ? `${min}–${max}` : min ? `From ${min}` : max ? `Up to ${max}` : "";
  return [
    row("compensationUndecided", c.undecided ? "Not decided yet" : ""),
    row(min ? "salaryMin" : "salaryMax", range ? [c.currency, range, period].filter(Boolean).join(" ") : ""),
    row("bonusStructure", c.bonus),
    row("equity", COMP_EQUITY_LABELS[c.equity as keyof typeof COMP_EQUITY_LABELS] ?? ""),
    row("compensationFlexible", c.flexible ? "Flexible for the right person" : ""),
    row("compensationNote", c.note, { fullWidth: true }),
  ];
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
      .map((r) => r.text);
  const listRow = (field: string, items: string[]) => row(field, items.join("\n"), { items, fullWidth: true });
  const stages = (s.interviewStages ?? []).filter((st) => st.name.trim() || st.ownerName?.trim() || st.ownerEmail?.trim()).map((st) => ({
    name: st.name,
    format: INTERVIEW_STAGE_FORMAT_LABELS[st.format] ?? "",
    owner: [st.ownerName, st.ownerEmail].filter((v) => v?.trim()).join(" — "),
  }));
  const collaborators = (s.collaborators ?? []).filter((c) => c.name.trim() || c.email.trim());

  const remoteBoundary = [
    s.remoteAnywhereInCountry ? "Anywhere in the country" : "",
    s.remoteTimezoneLabels.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const candidates: Array<IntakeReviewRow | null> = [
    row("roleTitle", s.roleTitle),
    row("team", s.team),
    row("seniority", formatEnumLabel(s.seniority)),
    row("employmentType", formatEnumLabel(s.employmentType)),
    row("jdFilename", s.jdFilename ?? "", { fullWidth: true }),
    row("jobDescriptionText", s.jobDescriptionText, { fullWidth: true }),
    listRow("mustHaves", tagged("must_have")),
    listRow("niceToHaves", tagged("nice_to_have")),
    listRow("trainable", tagged("trainable")),
    row("location", s.location),
    row("workModel", s.workModelLabel),
    row("onsiteDays", s.onsiteDays ? `${s.onsiteDays} days a week` : ""),
    row("remoteTimezones", remoteBoundary),
    row("sponsorshipAvailable", s.sponsorshipLabel),
    row("workAuthorization", s.sponsorshipLabel ? "" : s.workAuthorizationLabel),
    ...(s.compensation ? reviewCompensationRows(s.compensation) : [row("salaryMin", s.compensationLine)]),
    // workAuthorization is DERIVED from the sponsorship answer — the intake
    // form says so at the point it sets it: "the same answer in other words,
    // so it is derived rather than asked twice". Reviewing it as its own row
    // printed one answer under two names with identical values, which reads as
    // two separate commitments and pads the list a client is asked to check
    // carefully (audit 1 Sep, F31). The free-text NOTE is genuinely extra
    // information and stays.
    row("workAuthorizationNote", s.workAuthorizationNote, { fullWidth: true }),
    row("targetStartDate", s.targetStartDate),
    stages.length ? row("interviewStages", stages.map((st) => [st.name, st.format, st.owner].filter(Boolean).join(" — ")).join("\n"), { stages, fullWidth: true }) : listRow("interviewStages", s.interviewStageLines),
    row("interviewProcess", s.interviewProcess, { fullWidth: true }),
    row("targetDaysToOffer", s.targetDaysToOffer ? `${s.targetDaysToOffer} days` : ""),
    row("decisionMaker", s.decisionMaker),
    row("decisionMakerEmail", s.decisionMakerEmail),
    listRow("dealBreakerList", s.dealBreakers),
    row("inviteCollaborators", collaborators.length ? `${s.inviteCollaborators ? "Invite these people after the role is accepted" : "No invitations requested — nobody on this list will be emailed"}\n${collaborators.map((c) => [c.name, c.email].filter(Boolean).join(" — ")).join("\n")}` : "", { fullWidth: true }),
    row("companyName", s.companyName),
    row("companyWebsite", s.companyWebsite),
    row("companyLinkedin", s.companyLinkedin),
    row("firstName", [s.firstName, s.lastName].filter(Boolean).join(" "), { label: "Hiring contact" }),
    row("contactTitle", s.contactTitle),
    row("workEmail", s.workEmail),
    row("phone", s.phone),
    row("contactLinkedin", s.contactLinkedin),
  ];

  const rows = candidates.filter((r): r is IntakeReviewRow => r !== null);
  const answered = new Set(rows.map((r) => r.field));
  // Name and surname share one row, so surname counts as answered with it.
  if (!s.firstName.trim()) answered.delete("firstName");
  if (s.lastName.trim()) answered.add("lastName");
  if (s.requirements.some((r) => r.tag === "must_have" && r.text.trim())) answered.add("requirements");
  if (s.compensation?.salaryMin.trim()) answered.add("salaryMin");
  if (s.compensation?.salaryMax.trim()) answered.add("salaryMax");

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

  const groups: IntakeReviewGroup[] = SECTIONS.map(({ id, title, fields }) => ({
    id,
    step: rows.find((r) => fields.includes(r.field))?.step ?? 0,
    title,
    rows: fields.flatMap((field) => rows.filter((r) => r.field === field)),
  })).filter((g) => g.rows.length > 0);

  return { groups, missing, answeredCount: rows.length, headline: [s.roleTitle, s.companyName].filter((v) => v.trim()).join(" · ") };
}
