/**
 * Optional details that would sharpen a role brief. Never a blocker: sourcing
 * runs regardless and anything open is covered on the call.
 *
 * Pure and shared: the same list drives the dashboard banner, the role page,
 * and anything else that has to tell a client exactly what is missing. Each
 * gap names the wizard step so the client knows where to go.
 */

export type RoleGap = {
  /** Stable key, useful for tests and analytics. */
  key: string;
  /** What the client reads. Plain, specific, no jargon. */
  label: string;
  /** Wizard step number that fixes it. */
  step: number;
};

export type ReadinessInput = {
  title?: string | null;
  description?: string | null;
  location?: string | null;
  work_model?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  must_have_skills?: unknown;
  experience?: string | null;
  responsibilities?: string | null;
  budget_min?: number | string | null;
  budget_max?: number | string | null;
  currency?: string | null;
};

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function listLength(v: unknown): number {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function hasNumber(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0;
}

/** Optional gaps, in the order a client would most usefully fill them. */
export function roleGaps(p: ReadinessInput): RoleGap[] {
  const gaps: RoleGap[] = [];

  if (!hasText(p.title)) gaps.push({ key: "title", label: "Job title", step: 1 });
  if (!hasText(p.description))
    gaps.push({ key: "description", label: "Role description or uploaded job description", step: 1 });
  if (!hasText(p.location) && !hasText(p.work_model))
    gaps.push({ key: "location", label: "Location or work model (remote, hybrid, onsite)", step: 1 });
  if (!hasText(p.employment_type))
    gaps.push({ key: "employment_type", label: "Employment type", step: 1 });
  if (!hasText(p.seniority)) gaps.push({ key: "seniority", label: "Seniority level", step: 1 });

  if (listLength(p.must_have_skills) === 0)
    gaps.push({ key: "must_have_skills", label: "Must-have skills we screen against", step: 2 });
  if (!hasText(p.experience))
    gaps.push({ key: "experience", label: "Experience required", step: 2 });
  if (!hasText(p.responsibilities))
    gaps.push({ key: "responsibilities", label: "Main responsibilities", step: 2 });

  if (!hasNumber(p.budget_min) || !hasNumber(p.budget_max))
    gaps.push({ key: "budget", label: "Salary range (minimum and maximum)", step: 3 });

  return gaps;
}

export function isRoleReady(p: ReadinessInput): boolean {
  return roleGaps(p).length === 0;
}
