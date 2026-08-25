/**
 * Canonical status semantics for every authenticated surface.
 *
 * One status key -> one tone, one label, one glyph. Admin, client and
 * candidate screens read from this registry so a "shortlisted" match never
 * looks like two different things in two places. The glyph exists so meaning
 * never depends on colour alone (WCAG 1.4.1).
 */

import { bandToTier, classifyBand } from "@/lib/scoring/bands";
import { candidateSafeLabel, statusLabel } from "@/lib/vocabulary";

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

/** Labels always come from the vocabulary module; here we add tone + glyph. */
function stage(key: string, tone: StatusTone, glyph: StatusGlyph): StatusMeaning {
  return { label: statusLabel(key), candidateLabel: candidateSafeLabel(key), tone, glyph };
}

/** Pipeline stage of a candidate match. */
export const STAGE_STATUS = {
  new: def(stage("new", "neutral", "dot")),
  screening: def(stage("screening", "info", "clock")),
  review: def(stage("in_review", "info", "clock")),
  shortlisted: def(stage("shortlisted", "success", "arrow")),
  interview: def(stage("interview_process", "info", "arrow")),
  offer: def(stage("offer", "success", "check")),
  hired: def(stage("hired", "success", "check")),
  rejected: def(stage("not_moving_forward", "danger", "cross")),
  withdrawn: def(stage("withdrawn", "neutral", "pause")),
} as const;

/** Processing state of an uploaded CV / screening run. */
export const PROCESSING_STATUS = {
  queued: def(stage("queued", "neutral", "clock")),
  processing: def(stage("processing", "info", "clock")),
  completed: def(stage("completed", "success", "check")),
  failed: def(stage("failed", "danger", "alert")),
  skipped: def(stage("skipped", "neutral", "pause")),
} as const;

/** Lifecycle of a position. */
export const POSITION_STATUS = {
  draft: def(stage("draft", "neutral", "dot")),
  intake: def(stage("intake", "info", "clock")),
  open: def(stage("open", "success", "check")),
  paused: def(stage("paused", "warning", "pause")),
  filled: def(stage("filled", "success", "check")),
  closed: def(stage("closed", "neutral", "cross")),
} as const;

/** Publication state on the public job board. */
export const PUBLISH_STATUS = {
  unpublished: def(stage("unpublished", "neutral", "dot")),
  pending: def(stage("pending", "warning", "clock")),
  published: def(stage("live", "success", "check")),
} as const;

/** Interview scheduling state. */
export const INTERVIEW_STATUS = {
  proposed: def(stage("proposed", "warning", "clock")),
  scheduled: def(stage("scheduled", "info", "check")),
  completed: def(stage("completed", "success", "check")),
  cancelled: def(stage("cancelled", "danger", "cross")),
  no_show: def(stage("no_show", "danger", "alert")),
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
  // Same five words as the fit bands (src/lib/client-fit-presentation.ts).
  excellent: { label: "Top", tone: "success" },
  strong: { label: "Strong", tone: "success" },
  moderate: { label: "Consider", tone: "warning" },
  weak: { label: "Consider", tone: "warning" },
  poor: { label: "Not recommended", tone: "danger" },
};

/** Wording only — the numbers come from the canonical band table. */
export function scoreBand(score: number | null | undefined): ScoreBandKey | null {
  return bandToTier(classifyBand(score));
}
