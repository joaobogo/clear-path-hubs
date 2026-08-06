/**
 * Score provenance.
 *
 * Wherever staff see a fit number we show where that number came from: the value
 * the engine produced, any human override on top of it, who made that override
 * and why, and which published criteria version was used. A number without this
 * context is not shippable to a recruiter making a decision.
 */

export type ProvenanceOverride = {
  value: number | null;
  actor: string | null;
  reason: string | null;
  at: string | null;
};

export type ScoreProvenance = {
  /** What the engine computed, before any human intervention. */
  engineValue: number | null;
  /** The value in force now (override if present, else engine). */
  effectiveValue: number | null;
  override: ProvenanceOverride | null;
  rubric: { id: string | null; label: string | null; versionNumber: number | null };
  engineVersion: string | null;
  computedAt: string | null;
  /** True when no published rubric version backs this score. */
  unversioned: boolean;
};

type RunLike = {
  final_score?: number | null;
  raw_score?: number | null;
  score?: number | null;
  engine_version?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  rubric_version_id?: string | null;
} | null | undefined;

type DecisionLike = {
  decision_type?: string | null;
  score_override?: number | null;
  override_score?: number | null;
  reason?: string | null;
  notes?: string | null;
  created_at?: string | null;
  actor_name?: string | null;
  actor_user_id?: string | null;
};

type RubricLike = { id?: string | null; label?: string | null; version_number?: number | null } | null | undefined;

const OVERRIDE_TYPES = new Set(["manual_override", "adjust", "override"]);

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveScoreProvenance(args: {
  run: RunLike;
  decisions?: DecisionLike[];
  rubric?: RubricLike;
}): ScoreProvenance {
  const run = args.run ?? null;
  const engineValue = numOrNull(run?.raw_score) ?? numOrNull(run?.final_score) ?? numOrNull(run?.score);

  const overrideDecision = (args.decisions ?? [])
    .filter((d) => OVERRIDE_TYPES.has(String(d.decision_type ?? "")))
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];

  const overrideValue = overrideDecision
    ? (numOrNull(overrideDecision.score_override) ?? numOrNull(overrideDecision.override_score))
    : null;

  const finalValue = numOrNull(run?.final_score) ?? numOrNull(run?.score) ?? engineValue;

  const override: ProvenanceOverride | null = overrideDecision
    ? {
        value: overrideValue ?? finalValue,
        actor: overrideDecision.actor_name ?? overrideDecision.actor_user_id ?? null,
        reason: overrideDecision.reason ?? overrideDecision.notes ?? null,
        at: overrideDecision.created_at ?? null,
      }
    : null;

  return {
    engineValue,
    effectiveValue: override?.value ?? finalValue,
    override,
    rubric: {
      id: args.rubric?.id ?? run?.rubric_version_id ?? null,
      label: args.rubric?.label ?? null,
      versionNumber: args.rubric?.version_number ?? null,
    },
    engineVersion: run?.engine_version ?? null,
    computedAt: run?.completed_at ?? run?.created_at ?? null,
    unversioned: !(args.rubric?.id ?? run?.rubric_version_id),
  };
}
