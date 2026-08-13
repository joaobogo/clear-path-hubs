/**
 * Compact application review timeline: CV parsed → Scored → Reviewed → Published.
 *
 * Derived only from facts already recorded on the match and its approved score
 * run. Nothing here invents progress: a step is "done" only when a real stamp
 * (or a state that necessarily follows it) exists, "active" when it is the step
 * currently in flight, "blocked" when processing failed, otherwise "pending".
 */

export type ReviewStepKey = "parsed" | "scored" | "reviewed" | "published";
export type ReviewStepStatus = "done" | "active" | "pending" | "blocked";

export type ReviewStep = {
  key: ReviewStepKey;
  label: string;
  status: ReviewStepStatus;
  at: string | null;
  note: string;
};

export type ReviewTimeline = {
  steps: ReviewStep[];
  /** Index of the step the candidate currently sits at (0-based). */
  currentIndex: number;
  /** One short line for tooltips and screen readers. */
  summary: string;
};

const LABELS: Record<ReviewStepKey, string> = {
  parsed: "CV read",
  scored: "Scored",
  reviewed: "Reviewed",
  published: "Shared with you",
};

/** Processing states that mean the CV has been read successfully. */
const PARSED_STATES = new Set([
  "parsed",
  "enriching",
  "ready_to_score",
  "scoring",
  "scored",
  "manual_review_required",
]);
const PARSE_FAILED_STATES = new Set(["failed", "provider_blocked", "ocr_required"]);

/** Canonical states at or beyond human review. */
const REVIEWED_STATES = new Set(["approved", "published_to_client"]);

export type ReviewTimelineInput = {
  processing_state?: string | null;
  canonical_state?: string | null;
  applied_at?: string | null;
  processing_updated_at?: string | null;
  scored_at?: string | null;
  human_reviewed?: boolean;
  published_at?: string | null;
  stage?: string | null;
};

export function buildReviewTimeline(input: ReviewTimelineInput): ReviewTimeline {
  const proc = input.processing_state ?? null;
  const canon = input.canonical_state ?? null;
  const published = input.published_at ?? null;
  const scoredAt = input.scored_at ?? null;

  const parseFailed = proc != null && PARSE_FAILED_STATES.has(proc);
  const parsed =
    Boolean(published) ||
    Boolean(scoredAt) ||
    (proc != null && PARSED_STATES.has(proc)) ||
    (canon != null && canon !== "ingestion" && canon !== "failed");

  const scored = Boolean(scoredAt) || Boolean(published);
  const reviewed =
    Boolean(published) ||
    Boolean(input.human_reviewed) ||
    (canon != null && REVIEWED_STATES.has(canon));
  const isPublished =
    Boolean(published) ||
    canon === "published_to_client" ||
    (input.stage != null && input.stage !== "new" && input.stage !== "reviewing");

  const done: Record<ReviewStepKey, boolean> = { parsed, scored, reviewed, published: isPublished };
  const stamp: Record<ReviewStepKey, string | null> = {
    parsed: parsed ? (input.processing_updated_at ?? input.applied_at ?? null) : null,
    scored: scored ? scoredAt : null,
    reviewed: reviewed ? (published ?? scoredAt) : null,
    published: isPublished ? published : null,
  };

  const order: ReviewStepKey[] = ["parsed", "scored", "reviewed", "published"];
  const firstPending = order.findIndex((k) => !done[k]);
  const currentIndex = firstPending === -1 ? order.length - 1 : firstPending;

  const steps: ReviewStep[] = order.map((key, i) => {
    let status: ReviewStepStatus = done[key] ? "done" : i === firstPending ? "active" : "pending";
    if (key === "parsed" && !parsed && parseFailed) status = "blocked";
    return {
      key,
      label: LABELS[key],
      status,
      at: stamp[key],
      note:
        status === "done"
          ? `${LABELS[key]} — complete`
          : status === "blocked"
            ? "We could not read this CV yet"
            : status === "active"
              ? `${LABELS[key]} — in progress`
              : `${LABELS[key]} — not started`,
    };
  });

  const summary =
    firstPending === -1
      ? "Shared with you — review complete"
      : steps[currentIndex].status === "blocked"
        ? "Waiting on a readable CV"
        : `Now: ${LABELS[order[currentIndex]].toLowerCase()}`;

  return { steps, currentIndex, summary };
}
