/**
 * Client-workspace stage names — a thin view over the one vocabulary module.
 *
 * The labels themselves live in `src/lib/vocabulary.ts`. Capitalisation is a
 * CSS concern (`uppercase`, `capitalize`), never a second stored spelling.
 */

import { PIPELINE_STAGE_VOCABULARY, clientStatusLabel } from "@/lib/vocabulary";

export const PIPELINE_STAGE_DISPLAY = {
  delivered: PIPELINE_STAGE_VOCABULARY.delivered.client,
  shortlisted: PIPELINE_STAGE_VOCABULARY.shortlisted.client,
  interview_process: PIPELINE_STAGE_VOCABULARY.interview_process.client,
  offer: PIPELINE_STAGE_VOCABULARY.offer.client,
  hired: PIPELINE_STAGE_VOCABULARY.hired.client,
  not_moving_forward: PIPELINE_STAGE_VOCABULARY.not_moving_forward.client,
} as const;

export type PipelineStageKey = keyof typeof PIPELINE_STAGE_DISPLAY;

/** The single display name for a stage on client surfaces. */
export function stageDisplayName(stage: string | null | undefined): string {
  return clientStatusLabel(stage);
}
