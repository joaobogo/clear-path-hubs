/**
 * Flag contradictions between what the client said and what the JD says.
 *
 * Today whichever value is parsed last silently wins. Nothing here picks a
 * winner: each conflict names both values, their sources, and waits for a
 * human to choose. Generation stays blocked while a conflict is unresolved.
 */

export type BriefSource = "intake" | "job_description";

export type BriefConflict = {
  field: string;
  /** What the client typed into intake. */
  intake_value: string;
  /** What the uploaded JD says. */
  jd_value: string;
  /** What the reviewer reads, in plain English. */
  question: string;
  /** Set once a human picks; until then the field is unresolved. */
  resolved_to?: BriefSource | null;
};

export type ComparableBrief = {
  title?: string | null;
  seniority?: string | null;
  employment_type?: string | null;
  work_model?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const norm = (v: unknown): string =>
  text(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const LABELS: Record<string, string> = {
  title: "job title",
  seniority: "seniority",
  employment_type: "employment type",
  work_model: "work model",
  location: "location",
  compensation: "salary range",
};

/** Numbers this far apart are a real disagreement, not a rounding difference. */
const SALARY_TOLERANCE = 0.1;

function conflict(field: string, intake: string, jd: string): BriefConflict {
  const label = LABELS[field] ?? field.replace(/_/g, " ");
  return {
    field,
    intake_value: intake,
    jd_value: jd,
    question: `Your intake says the ${label} is "${intake}". The uploaded job description says "${jd}". Which one should we publish?`,
    resolved_to: null,
  };
}

/**
 * Every disagreement between the two inputs. An empty value on either side is
 * not a conflict — it is a gap, handled by the publish gates.
 */
export function findBriefConflicts(
  intake: ComparableBrief,
  jd: ComparableBrief,
): BriefConflict[] {
  const out: BriefConflict[] = [];

  for (const field of ["title", "seniority", "employment_type", "work_model", "location"] as const) {
    const a = text(intake[field]);
    const b = text(jd[field]);
    if (!a || !b) continue;
    if (norm(a) !== norm(b)) out.push(conflict(field, a, b));
  }

  const aMin = num(intake.salary_min);
  const aMax = num(intake.salary_max);
  const bMin = num(jd.salary_min);
  const bMax = num(jd.salary_max);
  const currencyClash =
    text(intake.currency) !== "" &&
    text(jd.currency) !== "" &&
    norm(intake.currency) !== norm(jd.currency);

  const far = (a: number | null, b: number | null) =>
    a !== null && b !== null && Math.abs(a - b) / Math.max(a, b) > SALARY_TOLERANCE;

  if (currencyClash || far(aMin, bMin) || far(aMax, bMax)) {
    const show = (min: number | null, max: number | null, cur: string) =>
      [cur, [min, max].filter((n) => n !== null).join("–")].filter(Boolean).join(" ") || "not stated";
    out.push(
      conflict(
        "compensation",
        show(aMin, aMax, text(intake.currency)),
        show(bMin, bMax, text(jd.currency)),
      ),
    );
  }

  return out;
}

/** Generation waits while any conflict is unresolved. */
export function hasUnresolvedConflict(conflicts: BriefConflict[]): boolean {
  return conflicts.some((c) => !c.resolved_to);
}

/** Applies a human's choice. Never guesses, never merges. */
export function resolveConflict(
  conflict: BriefConflict,
  choice: BriefSource,
): BriefConflict {
  return { ...conflict, resolved_to: choice };
}
