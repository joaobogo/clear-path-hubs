/**
 * Stage-aging constants — single source of truth.
 *
 * Thresholds are expressed in whole days a candidate may sit in a stage before
 * the stage is flagged as aging. Stages that are terminal (hired, archived,
 * not_moving_forward) never age.
 *
 * Keep every stage-aging threshold in this file. Do not inline day numbers in
 * components or server modules.
 */

export const PIPELINE_STAGES = [
  "new",
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
  "not_moving_forward",
  "archived",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Stages that no longer move — excluded from aging flags. */
export const TERMINAL_STAGES: readonly PipelineStage[] = [
  "hired",
  "not_moving_forward",
  "archived",
];

/**
 * Days-in-stage threshold per stage. Screening work (new/reviewing) = 3d,
 * submitted to client (delivered/shortlisted) = 5d, interview = 7d, offer = 3d.
 */
export const STAGE_AGING_THRESHOLD_DAYS: Record<PipelineStage, number | null> = {
  new: 3,
  reviewing: 3,
  delivered: 5,
  shortlisted: 5,
  interview_process: 7,
  offer: 3,
  hired: null,
  not_moving_forward: null,
  archived: null,
};

export const STAGE_LABEL: Record<PipelineStage, string> = {
  new: "New",
  reviewing: "Screening",
  delivered: "Submitted",
  shortlisted: "Shortlisted",
  interview_process: "Interview",
  offer: "Offer",
  hired: "Hired",
  not_moving_forward: "Not moving forward",
  archived: "Archived",
};

export function stageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  return STAGE_LABEL[stage as PipelineStage] ?? stage.replace(/_/g, " ");
}

export function stageThresholdDays(stage: string | null | undefined): number | null {
  if (!stage) return null;
  return STAGE_AGING_THRESHOLD_DAYS[stage as PipelineStage] ?? null;
}

export function isStageAging(
  stage: string | null | undefined,
  daysInStage: number | null | undefined,
): boolean {
  const threshold = stageThresholdDays(stage);
  if (threshold == null || daysInStage == null) return false;
  return daysInStage > threshold;
}

export function daysBetween(fromIso: string, nowMs = Date.now()): number {
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((nowMs - from) / 86_400_000));
}
