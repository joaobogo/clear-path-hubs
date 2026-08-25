import { PIPELINE_STAGE_DISPLAY } from "@/lib/client/stage-display";

/**
 * Plain-English stage labels for client-facing screens.
 *
 * Client copy never shows an internal lifecycle value. Anything not in this
 * map falls back to sentence case rather than leaking the raw enum with
 * underscores stripped.
 */
const CLIENT_STAGE_LABELS: Record<string, string> = {
  new: "Being screened",
  screening: "Being screened",
  sourced: "Being screened",
  in_review: "In review with us",
  delivered: PIPELINE_STAGE_DISPLAY.delivered,
  shortlisted: PIPELINE_STAGE_DISPLAY.shortlisted,
  interview_process: PIPELINE_STAGE_DISPLAY.interview_process,
  interview: PIPELINE_STAGE_DISPLAY.interview_process,
  offer: PIPELINE_STAGE_DISPLAY.offer,
  hired: PIPELINE_STAGE_DISPLAY.hired,
  not_moving_forward: PIPELINE_STAGE_DISPLAY.not_moving_forward,
  withdrawn: "Withdrew",
  on_hold: "On hold",
};

export function clientStageLabel(stage: string | null | undefined): string {
  if (!stage) return "—";
  const key = String(stage).trim().toLowerCase();
  const known = CLIENT_STAGE_LABELS[key];
  if (known) return known;
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
