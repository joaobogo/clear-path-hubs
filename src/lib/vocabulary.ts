/**
 * THE vocabulary module. One display label per stage/status enum in the
 * system, plus one candidate-safe label for what an applicant may read.
 *
 * Rules:
 *  1. Nothing else in the codebase may define a label map for a stage or
 *     status. Admin pages, client pages, the candidate portal, the public
 *     board, emails and notifications all read from here.
 *  2. Capitalisation is a CSS concern (`uppercase`, `capitalize`). A variant
 *     spelling is never stored — "INTERVIEWING", "Interview process" and
 *     "In interviews" were five spellings of one stage.
 *  3. Three audiences: internal (staff), client (employer), candidate
 *     (applicant). A missing client label falls back to the internal one; a
 *     missing candidate label falls back to the nearest candidate-safe state.
 */

export type LabelAudience = "internal" | "client" | "candidate";

/** The six words a candidate is ever allowed to read about their status. */
export const CANDIDATE_SAFE_STATUSES = [
  "Received",
  "Under review",
  "Shared with the employer",
  "Interviewing",
  "Offer stage",
  "Closed",
] as const;

export type CandidateSafeStatus = (typeof CANDIDATE_SAFE_STATUSES)[number];

type Entry = {
  /** Staff/admin label. */
  label: string;
  /** Employer-facing label; defaults to `label`. */
  client?: string;
  /** Candidate-facing label; always one of CANDIDATE_SAFE_STATUSES. */
  candidate?: CandidateSafeStatus;
};

/** Candidate match pipeline stages — the enum that carried five spellings. */
export const PIPELINE_STAGE_VOCABULARY = {
  new: { label: "New", client: "Being screened", candidate: "Received" },
  sourced: { label: "Sourced", client: "Being screened", candidate: "Received" },
  screening: { label: "Screening", client: "Being screened", candidate: "Under review" },
  in_review: { label: "In review", client: "In review with us", candidate: "Under review" },
  delivered: { label: "Delivered", client: "Awaiting your review", candidate: "Shared with the employer" },
  shortlisted: { label: "Shortlisted", client: "Shortlisted", candidate: "Shared with the employer" },
  interview_process: { label: "Interviewing", client: "Interviewing", candidate: "Interviewing" },
  offer: { label: "Offer", client: "Offer", candidate: "Offer stage" },
  hired: { label: "Hired", client: "Hired", candidate: "Offer stage" },
  not_moving_forward: { label: "Not moving forward", client: "Not moving forward", candidate: "Closed" },
  withdrawn: { label: "Withdrawn", client: "Withdrew", candidate: "Closed" },
  on_hold: { label: "On hold", client: "On hold", candidate: "Under review" },
} as const satisfies Record<string, Entry>;

export type PipelineStageKey = keyof typeof PIPELINE_STAGE_VOCABULARY;

/** Position lifecycle. */
export const POSITION_STATUS_VOCABULARY = {
  draft: { label: "Draft" },
  intake: { label: "Intake" },
  pending_review: { label: "Under review" },
  under_review: { label: "Under review" },
  awaiting_payment: { label: "Awaiting payment" },
  active: { label: "Active" },
  approved: { label: "Active" },
  open: { label: "Open" },
  published: { label: "Published" },
  paused: { label: "Paused" },
  filled: { label: "Filled", candidate: "Closed" },
  closed: { label: "Closed", candidate: "Closed" },
  cancelled: { label: "Closed", candidate: "Closed" },
  archived: { label: "Archived", candidate: "Closed" },
} as const satisfies Record<string, Entry>;

/** Application status as stored on `applications`. */
export const APPLICATION_STATUS_VOCABULARY = {
  received: { label: "Received", candidate: "Received" },
  processing: { label: "Processing", candidate: "Under review" },
  ready_for_review: { label: "Ready for review", candidate: "Under review" },
  shared: { label: "Shared with the employer", candidate: "Shared with the employer" },
  rejected: { label: "Not moving forward", candidate: "Closed" },
} as const satisfies Record<string, Entry>;

/** Interview scheduling state. */
export const INTERVIEW_STATUS_VOCABULARY = {
  requested: { label: "Interview requested", candidate: "Interviewing" },
  proposed: { label: "Times proposed", candidate: "Interviewing" },
  scheduling: { label: "Awaiting a time", candidate: "Interviewing" },
  scheduled: { label: "Scheduled", candidate: "Interviewing" },
  completed: { label: "Completed", candidate: "Interviewing" },
  cancelled: { label: "Cancelled", candidate: "Under review" },
  no_show: { label: "No show", candidate: "Under review" },
} as const satisfies Record<string, Entry>;

/** Publication state on the public job board. */
export const PUBLISH_STATUS_VOCABULARY = {
  unpublished: { label: "Not published" },
  pending: { label: "Awaiting approval" },
  live: { label: "Live" },
} as const satisfies Record<string, Entry>;

/** CV / screening run processing state. */
export const PROCESSING_STATUS_VOCABULARY = {
  queued: { label: "Queued", candidate: "Under review" },
  processing: { label: "Processing", candidate: "Under review" },
  completed: { label: "Complete", candidate: "Under review" },
  failed: { label: "Failed", candidate: "Under review" },
  skipped: { label: "Skipped", candidate: "Under review" },
} as const satisfies Record<string, Entry>;

/**
 * Aliases: legacy or shorthand spellings that must resolve to the same entry.
 * They exist so nothing has to store a second spelling.
 */
const ALIASES: Record<string, string> = {
  interview: "interview_process",
  interviewing: "interview_process",
  in_interviews: "interview_process",
  interview_process_stage: "interview_process",
  offer_out: "offer",
  offer_stage: "offer",
  shortlist: "shortlisted",
  hire: "hired",
  passed: "not_moving_forward",
  reviewing: "in_review",
  review: "in_review",
  screened: "screening",
  withdrew: "withdrawn",
  on_hold_stage: "on_hold",
};

const REGISTRY: Record<string, Entry> = {
  ...PROCESSING_STATUS_VOCABULARY,
  ...PUBLISH_STATUS_VOCABULARY,
  ...INTERVIEW_STATUS_VOCABULARY,
  ...APPLICATION_STATUS_VOCABULARY,
  ...POSITION_STATUS_VOCABULARY,
  // Pipeline stages win any key collision: they are the most-rendered enum.
  ...PIPELINE_STAGE_VOCABULARY,
};

function normalise(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function sentenceCase(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The entry for any stage/status value, or null when unknown. */
export function vocabularyEntry(value: string | null | undefined): Entry | null {
  const key = normalise(value);
  if (!key) return null;
  return REGISTRY[key] ?? REGISTRY[ALIASES[key] ?? ""] ?? null;
}

/**
 * The one label for a stage or status, for one audience. Unknown values fall
 * back to sentence case so a new enum value still reads as English.
 */
export function statusLabel(
  value: string | null | undefined,
  audience: LabelAudience = "internal",
): string {
  const key = normalise(value);
  if (!key) return "—";
  const entry = vocabularyEntry(key);
  if (!entry) return sentenceCase(key);
  if (audience === "candidate") return entry.candidate ?? "Under review";
  if (audience === "client") return entry.client ?? entry.label;
  return entry.label;
}

/** Employer-facing label. */
export function clientStatusLabel(value: string | null | undefined): string {
  return statusLabel(value, "client");
}

/**
 * The ONLY function that produces a label an applicant may read. The portal,
 * emails and notifications all call this.
 */
export function candidateSafeLabel(value: string | null | undefined): CandidateSafeStatus {
  const entry = vocabularyEntry(value);
  return entry?.candidate ?? "Under review";
}

/** True when a value is already a candidate-safe status word. */
export function isCandidateSafeStatus(value: string): value is CandidateSafeStatus {
  return (CANDIDATE_SAFE_STATUSES as readonly string[]).includes(value);
}
