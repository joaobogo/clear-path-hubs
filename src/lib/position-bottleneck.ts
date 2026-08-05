/**
 * Position bottleneck diagnosis — pure logic.
 *
 * A diagnosis is only produced when enough real pipeline exists. Below the
 * threshold the caller renders "Insufficient pipeline to diagnose" instead of a
 * conclusion. There are no industry benchmarks here: the only comparison is the
 * org's own closed roles, and only when enough of them exist.
 */
import { STAGE_LABEL, TERMINAL_STAGES, type PipelineStage } from "./stage-aging";

/** Minimum candidates that must have entered the pipeline to diagnose at all. */
export const MIN_PIPELINE_TO_DIAGNOSE = 5;
/** Minimum closed comparable roles before showing an org comparison. */
export const MIN_COMPARABLE_ROLES = 3;
/** Window used for the in/out flow ratio. */
export const BOTTLENECK_WINDOW_DAYS = 14;

/** Stages the diagnosis considers — terminal stages cannot be a bottleneck. */
export const DIAGNOSABLE_STAGES: readonly PipelineStage[] = [
  "new",
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
];

export type StageTransition = {
  match_id: string;
  from_stage: string | null;
  to_stage: string;
  at: string;
};

export type StageFlow = {
  stage: PipelineStage;
  label: string;
  /** Candidates that entered this stage within the window. */
  entered: number;
  /** Candidates that left this stage within the window. */
  exited: number;
  /** Candidates currently sitting in this stage. */
  current: number;
  /** entered / max(exited, 1) — higher means work piles up here. */
  ratio: number;
  median_days: number | null;
  org_median_days: number | null;
};

export type BottleneckDiagnosis =
  | {
      state: "insufficient";
      entered_total: number;
      threshold: number;
      stages: StageFlow[];
    }
  | {
      state: "diagnosed";
      entered_total: number;
      threshold: number;
      stages: StageFlow[];
      bottleneck_stage: PipelineStage;
      bottleneck_label: string;
      comparison: { available: boolean; roles_compared: number };
    };

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0
    ? Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2)
    : (s[mid] as number);
}

const DAY = 86_400_000;

/**
 * Per-stage durations in days, derived from consecutive transitions of the same
 * match. A stage the candidate is still in counts up to `nowMs`.
 */
export function stageDurations(
  transitions: StageTransition[],
  currentStageByMatch: Map<string, string | null>,
  nowMs = Date.now(),
): Map<string, number[]> {
  const byMatch = new Map<string, StageTransition[]>();
  for (const t of transitions) {
    const list = byMatch.get(t.match_id) ?? [];
    list.push(t);
    byMatch.set(t.match_id, list);
  }
  const out = new Map<string, number[]>();
  const push = (stage: string, days: number) => {
    const list = out.get(stage) ?? [];
    list.push(days);
    out.set(stage, list);
  };

  for (const [matchId, list] of byMatch) {
    list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i] as StageTransition;
      const next = list[i + 1];
      const start = new Date(entry.at).getTime();
      const endIso = next?.at;
      const isOpen = !endIso;
      // An open final entry only counts while the match is still in that stage.
      if (isOpen && currentStageByMatch.get(matchId) !== entry.to_stage) continue;
      const end = endIso ? new Date(endIso).getTime() : nowMs;
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      push(entry.to_stage, Math.max(0, Math.floor((end - start) / DAY)));
    }
  }
  return out;
}

export function diagnoseBottleneck(input: {
  transitions: StageTransition[];
  currentStages: Array<{ match_id: string; stage: string | null }>;
  /** Transitions restricted to the flow window. */
  windowTransitions: StageTransition[];
  /** Distinct matches that entered the pipeline at all (any time). */
  enteredTotal: number;
  orgMedians: Map<string, number | null>;
  rolesCompared: number;
  nowMs?: number;
}): BottleneckDiagnosis {
  const nowMs = input.nowMs ?? Date.now();
  const currentByMatch = new Map<string, string | null>(
    input.currentStages.map((m) => [m.match_id, m.stage]),
  );
  const durations = stageDurations(input.transitions, currentByMatch, nowMs);

  const stages: StageFlow[] = DIAGNOSABLE_STAGES.map((stage) => {
    const entered = new Set(
      input.windowTransitions.filter((t) => t.to_stage === stage).map((t) => t.match_id),
    ).size;
    const exited = new Set(
      input.windowTransitions.filter((t) => t.from_stage === stage).map((t) => t.match_id),
    ).size;
    const current = input.currentStages.filter((m) => m.stage === stage).length;
    return {
      stage,
      label: STAGE_LABEL[stage],
      entered,
      exited,
      current,
      ratio: entered === 0 ? 0 : entered / Math.max(exited, 1),
      median_days: median(durations.get(stage) ?? []),
      org_median_days: input.orgMedians.get(stage) ?? null,
    };
  });

  if (input.enteredTotal < MIN_PIPELINE_TO_DIAGNOSE) {
    return {
      state: "insufficient",
      entered_total: input.enteredTotal,
      threshold: MIN_PIPELINE_TO_DIAGNOSE,
      stages,
    };
  }

  const candidates = stages.filter(
    (s) => !TERMINAL_STAGES.includes(s.stage) && s.entered > 0 && s.ratio > 0,
  );
  if (candidates.length === 0) {
    return {
      state: "insufficient",
      entered_total: input.enteredTotal,
      threshold: MIN_PIPELINE_TO_DIAGNOSE,
      stages,
    };
  }
  const worst = candidates.reduce((acc, s) => {
    if (s.ratio > acc.ratio) return s;
    if (s.ratio === acc.ratio && s.current > acc.current) return s;
    return acc;
  });

  return {
    state: "diagnosed",
    entered_total: input.enteredTotal,
    threshold: MIN_PIPELINE_TO_DIAGNOSE,
    stages,
    bottleneck_stage: worst.stage,
    bottleneck_label: worst.label,
    comparison: {
      available: input.rolesCompared >= MIN_COMPARABLE_ROLES,
      roles_compared: input.rolesCompared,
    },
  };
}
