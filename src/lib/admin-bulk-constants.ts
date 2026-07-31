// Client-safe constants shared by the bulk-action UI and server logic.
export const BULK_STAGES = [
  "screening",
  "shortlisted",
  "interview_process",
  "offer",
  "not_moving_forward",
] as const;
export type BulkStage = (typeof BULK_STAGES)[number];
