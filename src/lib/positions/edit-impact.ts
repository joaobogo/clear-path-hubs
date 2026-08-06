/**
 * What a brief edit does to the live posting and to candidates already in
 * flight — shown before the save, not discovered after it.
 *
 * Pure: the wizard passes the before/after state and the counts it already
 * loaded. Three questions get answered — does the posting need republishing,
 * did the screening criteria change, and how many assessments go stale.
 */

export type EditImpactField =
  | "title"
  | "description"
  | "location"
  | "work_model"
  | "employment_type"
  | "seniority"
  | "must_have_skills"
  | "nice_to_have_skills"
  | "experience"
  | "responsibilities"
  | "budget_min"
  | "budget_max"
  | "currency"
  | "budget_period"
  | "screening_questions";

/** Fields visible on the public posting: changing them needs a republish. */
const POSTING_FIELDS: EditImpactField[] = [
  "title",
  "description",
  "location",
  "work_model",
  "employment_type",
  "seniority",
  "budget_min",
  "budget_max",
  "currency",
  "budget_period",
];

/** Fields we screen and score against: changing them invalidates assessments. */
const CRITERIA_FIELDS: EditImpactField[] = [
  "must_have_skills",
  "nice_to_have_skills",
  "experience",
  "responsibilities",
  "seniority",
  "screening_questions",
];

export const IMPACT_FIELD_LABEL: Record<EditImpactField, string> = {
  title: "Job title",
  description: "Role description",
  location: "Location",
  work_model: "Work model",
  employment_type: "Employment type",
  seniority: "Seniority",
  must_have_skills: "Must-have skills",
  nice_to_have_skills: "Nice-to-have skills",
  experience: "Experience required",
  responsibilities: "Responsibilities",
  budget_min: "Salary minimum",
  budget_max: "Salary maximum",
  currency: "Currency",
  budget_period: "Salary period",
  screening_questions: "Screening questions",
};

export type EditImpact = {
  changed: EditImpactField[];
  republish_needed: boolean;
  criteria_changed: boolean;
  /** Assessments that become stale, or null when we could not count them. */
  stale_scores: number | null;
  /** Candidates already in an interview or offer stage. */
  in_flight: number | null;
  /** Plain lines to show before the save. Empty means "nothing notable". */
  lines: string[];
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const la = Array.isArray(a) ? a.map(String) : [];
    const lb = Array.isArray(b) ? b.map(String) : [];
    return la.length === lb.length && la.every((v, i) => v === lb[i]);
  }
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a ?? "") === String(b ?? "");
}

export function assessEditImpact(input: {
  before: Partial<Record<EditImpactField, unknown>>;
  after: Partial<Record<EditImpactField, unknown>>;
  /** Candidates with a stored assessment on this role. */
  scored_candidates?: number | null;
  /** Candidates currently in interview or offer. */
  in_flight?: number | null;
  /** Is the role publicly posted right now. */
  published?: boolean;
}): EditImpact {
  const fields = Object.keys(IMPACT_FIELD_LABEL) as EditImpactField[];
  const changed = fields.filter((f) => !sameValue(input.before[f], input.after[f]));

  const republish_needed =
    Boolean(input.published) && changed.some((f) => POSTING_FIELDS.includes(f));
  const criteria_changed = changed.some((f) => CRITERIA_FIELDS.includes(f));
  const stale_scores = criteria_changed ? (input.scored_candidates ?? null) : 0;
  const in_flight = input.in_flight ?? null;

  const lines: string[] = [];
  if (republish_needed) {
    lines.push("The public posting changes, so it is republished with the new wording.");
  }
  if (criteria_changed) {
    lines.push("Screening criteria change, so we reassess against the new brief.");
    if (stale_scores && stale_scores > 0) {
      lines.push(
        `${stale_scores} assessment${stale_scores === 1 ? "" : "s"} will be marked as needing a fresh look.`,
      );
    }
  }
  if (criteria_changed && in_flight && in_flight > 0) {
    lines.push(
      `${in_flight} candidate${in_flight === 1 ? " is" : "s are"} already in interview or offer — they keep the criteria you agreed with them.`,
    );
  }

  return { changed, republish_needed, criteria_changed, stale_scores, in_flight, lines };
}
