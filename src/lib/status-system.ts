/**
 * Canonical status semantics for every authenticated surface.
 *
 * One status key -> one tone, one label, one glyph. Admin, client and
 * candidate screens read from this registry so a "shortlisted" match never
 * looks like two different things in two places. The glyph exists so meaning
 * never depends on colour alone (WCAG 1.4.1).
 */

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

/** Non-colour redundant encoding, rendered as a small leading mark. */
export type StatusGlyph = "dot" | "check" | "clock" | "alert" | "cross" | "arrow" | "pause";

export type StatusMeaning = {
  /** Human label. Candidate-facing wording lives in `candidateLabel`. */
  label: string;
  /** Plain-language label for candidate screens (no internal jargon). */
  candidateLabel?: string;
  tone: StatusTone;
  glyph: StatusGlyph;
  /** Longer explanation for tooltips and screen readers. */
  description?: string;
};

function def(m: StatusMeaning) {
  return m;
}

/** Pipeline stage of a candidate match. */
export const STAGE_STATUS = {
  new: def({ label: "New", candidateLabel: "Received", tone: "neutral", glyph: "dot" }),
  screening: def({ label: "Screening", candidateLabel: "In review", tone: "info", glyph: "clock" }),
  review: def({ label: "In review", candidateLabel: "In review", tone: "info", glyph: "clock" }),
  shortlisted: def({ label: "Shortlisted", candidateLabel: "Shortlisted", tone: "success", glyph: "arrow" }),
  interview: def({ label: "Interview", candidateLabel: "Interviewing", tone: "info", glyph: "arrow" }),
  offer: def({ label: "Offer", candidateLabel: "Offer stage", tone: "success", glyph: "check" }),
  hired: def({ label: "Hired", candidateLabel: "Hired", tone: "success", glyph: "check" }),
  rejected: def({ label: "Not moving forward", candidateLabel: "Not selected", tone: "danger", glyph: "cross" }),
  withdrawn: def({ label: "Withdrawn", candidateLabel: "Withdrawn", tone: "neutral", glyph: "pause" }),
} as const;

/** Processing state of an uploaded CV / screening run. */
export const PROCESSING_STATUS = {
  queued: def({ label: "Queued", candidateLabel: "Waiting to start", tone: "neutral", glyph: "clock" }),
  processing: def({ label: "Processing", candidateLabel: "In progress", tone: "info", glyph: "clock" }),
  completed: def({ label: "Complete", candidateLabel: "Complete", tone: "success", glyph: "check" }),
  failed: def({ label: "Failed", candidateLabel: "Needs another try", tone: "danger", glyph: "alert" }),
  skipped: def({ label: "Skipped", tone: "neutral", glyph: "pause" }),
} as const;

/** Lifecycle of a position. */
export const POSITION_STATUS = {
  draft: def({ label: "Draft", tone: "neutral", glyph: "dot" }),
  intake: def({ label: "Intake", tone: "info", glyph: "clock" }),
  open: def({ label: "Open", tone: "success", glyph: "check" }),
  paused: def({ label: "Paused", tone: "warning", glyph: "pause" }),
  filled: def({ label: "Filled", tone: "success", glyph: "check" }),
  closed: def({ label: "Closed", tone: "neutral", glyph: "cross" }),
} as const;

/** Publication state on the public job board. */
export const PUBLISH_STATUS = {
  unpublished: def({ label: "Not published", tone: "neutral", glyph: "dot" }),
  pending: def({ label: "Awaiting approval", tone: "warning", glyph: "clock" }),
  published: def({ label: "Live", tone: "success", glyph: "check" }),
} as const;

/** Interview scheduling state. */
export const INTERVIEW_STATUS = {
  proposed: def({ label: "Proposed", tone: "warning", glyph: "clock" }),
  scheduled: def({ label: "Scheduled", tone: "info", glyph: "check" }),
  completed: def({ label: "Completed", tone: "success", glyph: "check" }),
  cancelled: def({ label: "Cancelled", tone: "danger", glyph: "cross" }),
  no_show: def({ label: "No show", tone: "danger", glyph: "alert" }),
} as const;

/** Confidence of an evidence-backed assessment. */
export const CONFIDENCE_STATUS = {
  high: def({ label: "High confidence", tone: "success", glyph: "check" }),
  medium: def({ label: "Medium confidence", tone: "warning", glyph: "dot" }),
  low: def({ label: "Low confidence", tone: "danger", glyph: "alert" }),
  unknown: def({ label: "Not assessed", tone: "neutral", glyph: "dot" }),
} as const;

const REGISTRY = {
  ...STAGE_STATUS,
  ...PROCESSING_STATUS,
  ...POSITION_STATUS,
  ...PUBLISH_STATUS,
  ...INTERVIEW_STATUS,
  ...CONFIDENCE_STATUS,
} as Record<string, StatusMeaning>;

export type StatusKey = keyof typeof REGISTRY;

/**
 * Resolve any status string to its canonical meaning. Unknown values degrade
 * to a neutral badge carrying the raw value rather than throwing.
 */
export function resolveStatus(
  value: string | null | undefined,
  opts?: { audience?: "internal" | "candidate"; registry?: Record<string, StatusMeaning> },
): StatusMeaning {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const table = opts?.registry ?? REGISTRY;
  const found = table[key];
  if (!found) {
    return {
      label: key ? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Unknown",
      tone: "neutral",
      glyph: "dot",
    };
  }
  if (opts?.audience === "candidate" && found.candidateLabel) {
    return { ...found, label: found.candidateLabel };
  }
  return found;
}

/** Score band semantics shared by every score visual. */
export type ScoreBandKey = "excellent" | "strong" | "moderate" | "weak" | "poor";

export const SCORE_BANDS: Record<ScoreBandKey, { label: string; tone: StatusTone }> = {
  excellent: { label: "Excellent match", tone: "success" },
  strong: { label: "Strong match", tone: "success" },
  moderate: { label: "Moderate match", tone: "warning" },
  weak: { label: "Weak match", tone: "warning" },
  poor: { label: "Poor match", tone: "danger" },
};

/** Wording only — the numbers come from the canonical band table. */
export function scoreBand(score: number | null | undefined): ScoreBandKey | null {
  return bandToTier(classifyBand(score));
}
