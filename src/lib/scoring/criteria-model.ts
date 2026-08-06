/**
 * Client-safe criteria model: types plus the pure rules shared by the authoring
 * UI and the server. No database access lives here.
 */

export type CriterionDraft = {
  key: string;
  label: string;
  /** What counts as evidence for this criterion, in plain language. */
  evidence: string;
  /** Relative weight; normalised to 100 on publish. */
  weight: number;
  must_have: boolean;
};

export type RubricVersionSummary = {
  id: string;
  position_id: string;
  organization_id: string;
  label: string;
  version_number: number;
  status: string;
  editable: boolean;
  criteria: CriterionDraft[];
  created_at: string;
  approved_at: string | null;
  superseded_at: string | null;
  /** How many score runs referenced this version. */
  scored_runs: number;
};

export const EDITABLE_STATUSES = new Set([
  "draft",
  "pending_approval",
  "pending_client_approval",
]);

export const PUBLISHED_STATUSES = ["active", "approved"] as const;

export function normaliseWeights(criteria: CriterionDraft[]): CriterionDraft[] {
  const total = criteria.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  if (total <= 0) {
    const even = criteria.length > 0 ? Math.round(100 / criteria.length) : 0;
    return criteria.map((c) => ({ ...c, weight: even }));
  }
  return criteria.map((c) => ({
    ...c,
    weight: Math.round((Math.max(0, c.weight) / total) * 1000) / 10,
  }));
}

export function validateForPublish(criteria: CriterionDraft[]): string[] {
  const problems: string[] = [];
  if (criteria.length < 2) problems.push("A published rubric needs at least two criteria.");
  if (criteria.some((c) => !c.label.trim())) problems.push("Every criterion needs a label.");
  if (criteria.some((c) => !c.evidence.trim())) {
    problems.push("Every criterion needs to say what counts as evidence.");
  }
  if (!criteria.some((c) => c.must_have)) {
    problems.push("Mark at least one criterion as a must-have.");
  }
  const keys = new Set<string>();
  for (const c of criteria) {
    const key = c.key.trim();
    if (key && keys.has(key)) problems.push(`Duplicate criterion key: ${key}`);
    keys.add(key);
  }
  return problems;
}
