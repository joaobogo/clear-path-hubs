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
  delivered: "Awaiting your review",
  shortlisted: "Shortlisted by your team",
  interview_process: "In interviews",
  interview: "In interviews",
  offer: "At offer",
  hired: "Hired",
  not_moving_forward: "Not moving forward",
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
