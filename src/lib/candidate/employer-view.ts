/**
 * "What employers see" — the single manifest describing every top-level field
 * of the employer-facing candidate DTO (`ClientCandidateDTO`).
 *
 * This file is the contract between two surfaces:
 *   • the client workspace, which renders the DTO to the employer, and
 *   • /me/profile, which renders the SAME DTO back to the candidate.
 *
 * Rules for anything added here:
 *   1. Every top-level DTO key must appear exactly once. A test compares this
 *      manifest with the real DTO shape, so adding a field to the DTO without
 *      describing it here fails the build — the preview cannot drift.
 *   2. Never describe something as hidden when it is actually sent.
 *   3. Plain language. No scores-as-verdicts, no internal jargon.
 */

export type EmployerViewGroup =
  | "identity"
  | "experience"
  | "role_fit"
  | "practicalities"
  | "process";

export const EMPLOYER_VIEW_GROUPS: Array<{
  key: EmployerViewGroup;
  title: string;
  blurb: string;
}> = [
  {
    key: "identity",
    title: "How you are introduced",
    blurb: "The employer sees your first name and last initial until contact details are released.",
  },
  {
    key: "experience",
    title: "Your background",
    blurb: "Taken from your profile and your CV.",
  },
  {
    key: "role_fit",
    title: "Our review of your fit for this role",
    blurb: "Written by us from your CV and answers, with the quotes it came from.",
  },
  {
    key: "practicalities",
    title: "Practical details",
    blurb: "What you told us about working arrangements and pay.",
  },
  {
    key: "process",
    title: "Process record",
    blurb: "Where your application sits and how it got there.",
  },
];

export interface EmployerViewField {
  /** Top-level key of the employer DTO. */
  key: string;
  group: EmployerViewGroup;
  /** Candidate-facing label. */
  label: string;
  /** Why the employer receives it, or what it contains. Optional. */
  note?: string;
  /** Fields that carry no candidate-readable value on their own. */
  hidden?: boolean;
}

export const EMPLOYER_VIEW_FIELDS: EmployerViewField[] = [
  // identity
  {
    key: "candidate",
    group: "identity",
    label: "Name shown, location, timezone, headline, availability, years of experience, summary, current role and links",
    note: "Your name is shortened to first name plus last initial until you agree to contact release.",
  },
  { key: "match_id", group: "identity", label: "Internal reference for this shortlist entry", hidden: true },
  { key: "position", group: "identity", label: "The role you applied for" },

  // experience
  { key: "experience", group: "experience", label: "Work history" },
  { key: "skills", group: "experience", label: "Skills" },
  { key: "education", group: "experience", label: "Education" },
  { key: "languages", group: "experience", label: "Languages" },
  { key: "certifications", group: "experience", label: "Certifications" },

  // role fit
  { key: "fit", group: "role_fit", label: "Fit band for this role" },
  { key: "fit_label", group: "role_fit", label: "Fit band label" },
  {
    key: "explanation",
    group: "role_fit",
    label: "Why the fit band came out the way it did",
    note: "Employers see the requirements assessed and the passages from your application that supported each one — never a bare adjective.",
  },
  {
    key: "human_review",
    group: "role_fit",
    label: "Whether a person reviewed the assessment by hand",
    note: "Employers see the fact of the review and how many requirements were verified by a person — never the reviewer's internal note.",
  },

  {
    key: "score",
    group: "role_fit",
    label: "Numeric rating behind the fit band",
    note: "Employers see a fit band, not this number. It is a measure of how your evidence covers this role's requirements, not a judgement of you.",
  },
  {
    key: "evidence_support",
    group: "role_fit",
    label: "How many requirements your evidence supported",
    note: "Employers see this alongside the fit band, so they can tell how much of the role your application actually evidenced.",
  },
  {
    key: "unicorn",
    group: "role_fit",
    label: "Standout marker for exceptionally strong matches",
    note: "Set automatically for the very highest ratings. It only ever helps you.",
  },
  { key: "summary", group: "role_fit", label: "Written summary of your fit" },
  { key: "strengths", group: "role_fit", label: "Strengths we highlighted" },
  { key: "concerns", group: "role_fit", label: "Points we flagged for the employer to explore" },
  { key: "main_consideration", group: "role_fit", label: "The main thing we asked the employer to check" },
  { key: "requirement_rows", group: "role_fit", label: "Requirement-by-requirement coverage" },
  { key: "coverage", group: "role_fit", label: "Coverage totals" },
  {
    key: "score_composition",
    group: "role_fit",
    label: "How the rating was made up",
    note: "Shows how must-have coverage, nice-to-have signal and screening alignment combined into the rating.",
  },

  { key: "evidence", group: "role_fit", label: "Evidence extracts" },
  {
    key: "evidence_card",
    group: "role_fit",
    label: "Verified quotes from your CV and answers",
    note: "Quoted as written. Nothing is paraphrased into a claim you did not make.",
  },
  {
    key: "interview_guide",
    group: "role_fit",
    label: "Suggested interview questions",
    note: "Questions we suggest the employer asks you, based on the role.",
  },
  {
    key: "evaluation",
    group: "role_fit",
    label: "Which review version produced the assessment",
  },

  // practicalities
  { key: "work_authorization", group: "practicalities", label: "Work authorisation as you described it" },
  { key: "screening_answers", group: "practicalities", label: "Your answers to the role's screening questions" },
  {
    key: "compensation_alignment",
    group: "practicalities",
    label: "Your pay expectation against the role's range",
  },

  // process
  { key: "stage", group: "process", label: "Current stage" },
  { key: "delivered_at", group: "process", label: "Date you were shared with the employer" },
  { key: "interview_active", group: "process", label: "Whether an interview has been requested or held" },
  {
    key: "contact_released",
    group: "process",
    label: "Whether the employer may see your contact details and CV file",
  },

  { key: "stage_entered_at", group: "process", label: "Date you entered the current stage" },
  { key: "last_updated", group: "process", label: "Date the record was last updated" },
  {
    key: "freshness",
    group: "process",
    label:
      "Whether your assessment still matches your current profile and the role's current brief",
  },
  {
    key: "review_timeline",
    group: "process",
    label: "Where your application stands: CV read, scored, reviewed, shared",
    note: "Only steps that actually completed are shown as done.",
  },
  { key: "source_trace", group: "process", label: "How you reached this role, and your application reference" },
  {
    key: "audit_trail",
    group: "process",
    label: "Record of stage changes on this application",
  },
];

/** Things we hold or generate that are never sent to an employer. */
export const NEVER_SHARED: Array<{ item: string; why: string }> = [
  {
    item: "Your email address and phone number",
    why: "Held back until you agree to release them for a specific employer.",
  },
  {
    item: "Your street address",
    why: "Only your city, country and timezone are shared.",
  },
  {
    item: "Your other applications",
    why: "An employer only ever sees the application made to them.",
  },
  {
    item: "Your account details and login activity",
    why: "Never leaves our systems.",
  },
  {
    item: "Messages you send our team",
    why: "Support conversations stay between you and us.",
  },
  {
    item: "Rankings against other candidates",
    why: "We share your own assessment, never a leaderboard.",
  },
  {
    item: "Anything you have not given us",
    why: "We never infer age, health, religion, nationality or family status.",
  },
];

/** Items that ARE shared and are commonly assumed private — stated plainly. */
export const ALSO_SHARED: Array<{ item: string; why: string }> = [
  {
    item: "Your CV file, exactly as you uploaded it",
    why: "The employer can open and download it.",
  },
  {
    item: "Your public profile links",
    why: "LinkedIn, portfolio, GitHub and website, if you added them.",
  },
];

export const CONTACT_FIELDS = ["Full name", "Email address", "Phone number"] as const;

export function contactStateCopy(released: boolean): { label: string; detail: string } {
  return released
    ? {
        label: "Released",
        detail:
          "You agreed to share your contact details for this application, so the employer can see your full name, email and phone number.",
      }
    : {
        label: "Withheld",
        detail:
          "The employer sees your first name and last initial only. Your email and phone number stay with us until contact release is agreed.",
      };
}

export function fieldsForGroup(group: EmployerViewGroup): EmployerViewField[] {
  return EMPLOYER_VIEW_FIELDS.filter((f) => f.group === group && !f.hidden);
}
