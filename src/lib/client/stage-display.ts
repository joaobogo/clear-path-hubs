/**
 * ONE display name per pipeline stage, for the whole client workspace.
 *
 * Before this map, a single stage carried up to five spellings — "INTERVIEWING"
 * on the snapshot tiles, "Interview process" in the filter, "INTERVIEW PROCESS"
 * on the board, "In interviews" in the list and "In Interviews" on Insights.
 * Every surface now reads these strings; capitalisation is a CSS concern
 * (`uppercase`, `capitalize`), never a second stored spelling.
 */

export const PIPELINE_STAGE_DISPLAY = {
  delivered: "Awaiting your review",
  shortlisted: "Shortlisted",
  interview_process: "Interviewing",
  offer: "Offer",
  hired: "Hired",
  not_moving_forward: "Not moving forward",
} as const;

export type PipelineStageKey = keyof typeof PIPELINE_STAGE_DISPLAY;

/** Stage aliases that must resolve to the same display name. */
const STAGE_ALIASES: Record<string, PipelineStageKey> = {
  interview: "interview_process",
  interviewing: "interview_process",
  offer_out: "offer",
  shortlist: "shortlisted",
};

/**
 * The single display name for a stage. Unknown values fall back to sentence
 * case so a new enum value still reads as English instead of a raw token.
 */
export function stageDisplayName(stage: string | null | undefined): string {
  if (!stage) return "—";
  const key = String(stage).trim().toLowerCase();
  const resolved = (key in PIPELINE_STAGE_DISPLAY ? key : STAGE_ALIASES[key]) as
    | PipelineStageKey
    | undefined;
  if (resolved) return PIPELINE_STAGE_DISPLAY[resolved];
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
