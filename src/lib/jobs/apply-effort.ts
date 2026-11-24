/**
 * How long applying takes.
 *
 * Once a posting has enough completed submissions the number a candidate reads
 * is that posting's own recorded median. Until then it is an estimate for
 * someone who has their CV ready, worked out from the form itself: the steps
 * are the same for every role, so only the written answers move it. A missing
 * or broken measurement is never dressed up as a measured one.
 */

/** Below this many measured submissions the median is noise, not a fact. */
export const EFFORT_MIN_SAMPLE = 20;

/**
 * Used only while a posting is under EFFORT_MIN_SAMPLE, and on any read error:
 * a form with at most one written answer. On such forms a quarter of recorded
 * applicants were done within about three minutes; the recorded median is
 * longer because the clock runs from the moment the form opens, including the
 * time spent away from it.
 */
export const EFFORT_DEFAULT_MINUTES = 3;

/** Each written answer after the first adds this much to the estimate. */
export const EFFORT_MINUTES_PER_EXTRA_WRITTEN = 2;

/** Answer types a candidate has to write out, as opposed to pick or tick. */
const WRITTEN_ANSWER_TYPES = new Set(["text", "long_text"]);

/** Sanity bounds — anything outside these is a stale tab, not a real session. */
export const EFFORT_MIN_SECONDS = 20;
export const EFFORT_MAX_SECONDS = 7200;

export type ApplyEffort = {
  /** Minutes we are willing to state out loud. */
  minutes: number;
  /** True when `minutes` is the posting's own recorded median. */
  measured: boolean;
  /** Completed, measured submissions behind the median (0 when unmeasured). */
  sampleSize: number;
};

export const EFFORT_DEFAULT: ApplyEffort = {
  minutes: EFFORT_DEFAULT_MINUTES,
  measured: false,
  sampleSize: 0,
};

/**
 * The estimate for a form that has not been timed yet: EFFORT_DEFAULT_MINUTES,
 * plus EFFORT_MINUTES_PER_EXTRA_WRITTEN for each written answer after the
 * first. Ticks, choices, numbers and dates do not move it.
 */
export function applyEffortDefault(
  questions: ReadonlyArray<{ answer_type?: unknown }> | null | undefined,
): ApplyEffort {
  const written = (questions ?? []).filter((q) =>
    WRITTEN_ANSWER_TYPES.has(String(q?.answer_type ?? "")),
  ).length;
  return {
    minutes: EFFORT_DEFAULT_MINUTES + EFFORT_MINUTES_PER_EXTRA_WRITTEN * Math.max(0, written - 1),
    measured: false,
    sampleSize: 0,
  };
}

/**
 * Clamp a client-reported duration before it is stored. A candidate who leaves
 * the tab open overnight must not drag a posting's median with them, and a
 * negative or absurd value is discarded rather than saved.
 */
export function normalizeCompletionSeconds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const secs = Math.round(n);
  if (secs < EFFORT_MIN_SECONDS || secs > EFFORT_MAX_SECONDS) return null;
  return secs;
}

/**
 * Turn the raw stat into something we can state. Anything short of the
 * threshold — including a null median or an error shape — falls back to the
 * form's estimate (`fallback`), never to a figure presented as measured.
 */
export function resolveApplyEffort(
  stat: unknown,
  fallback: ApplyEffort = EFFORT_DEFAULT,
): ApplyEffort {
  const s = (stat ?? {}) as { sample_size?: unknown; median_seconds?: unknown };
  const sampleSize = Number(s.sample_size);
  const median = Number(s.median_seconds);
  if (
    !Number.isFinite(sampleSize) ||
    sampleSize < EFFORT_MIN_SAMPLE ||
    !Number.isFinite(median) ||
    median <= 0
  ) {
    return fallback;
  }
  // Round to the nearest minute: the acceptance bar is two minutes, and a
  // to-the-second figure would imply a precision we do not have.
  const minutes = Math.max(1, Math.round(median / 60));
  return { minutes, measured: true, sampleSize: Math.round(sampleSize) };
}

/**
 * Just the time clause, so every surface can state the same estimate in its
 * own sentence shape. This is the single source of truth for the duration
 * promise; the full line below builds on it.
 *
 * "about 3 minutes", whether it is the posting's median or the form's estimate.
 */
export function applyEffortTimeClause(effort: ApplyEffort): string {
  return `about ${effort.minutes} ${effort.minutes === 1 ? "minute" : "minutes"}`;
}

/**
 * The line beside the Apply button and at the top of the apply form. One
 * sentence, no exclamation marks, no countdown — cost, prerequisite, and the
 * fact that stopping halfway is safe.
 */
export function applyEffortLine(effort: ApplyEffort, steps: number): string {
  return `${steps} steps, ${applyEffortTimeClause(effort)}. You'll need your CV as a PDF. Your answers are saved as you go.`;
}

/** Where the figure came from, for anyone who wants to know. */
export function applyEffortProvenance(effort: ApplyEffort): string {
  return effort.measured
    ? `Median of ${effort.sampleSize} completed applications for this role.`
    : "An estimate for someone with their CV ready — this posting doesn't have enough completed applications yet to time it.";
}

/**
 * The steps of the apply form, shared so the job page's "how many steps"
 * promise cannot drift from the form that delivers them.
 */
export const APPLY_STEP_LABELS = [
  "Your details",
  "CV upload",
  "Screening",
  "Consent",
  "Review & submit",
] as const;

export const APPLY_STEPS = APPLY_STEP_LABELS.length;
