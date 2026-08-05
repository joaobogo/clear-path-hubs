/**
 * How long applying actually takes.
 *
 * The number a candidate reads has to be the recorded median for that posting,
 * not a hopeful figure. Until a posting has enough completed submissions to
 * have a stable median we say so with a platform default, and we never dress a
 * missing or broken measurement up as a measured one.
 */

/** Below this many measured submissions the median is noise, not a fact. */
export const EFFORT_MIN_SAMPLE = 20;

/** Used only while a posting is under EFFORT_MIN_SAMPLE, and on any read error. */
export const EFFORT_DEFAULT_MINUTES = 6;

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
 * platform default rather than to a made-up figure.
 */
export function resolveApplyEffort(stat: unknown): ApplyEffort {
  const s = (stat ?? {}) as { sample_size?: unknown; median_seconds?: unknown };
  const sampleSize = Number(s.sample_size);
  const median = Number(s.median_seconds);
  if (
    !Number.isFinite(sampleSize) ||
    sampleSize < EFFORT_MIN_SAMPLE ||
    !Number.isFinite(median) ||
    median <= 0
  ) {
    return EFFORT_DEFAULT;
  }
  // Round to the nearest minute: the acceptance bar is two minutes, and a
  // to-the-second figure would imply a precision we do not have.
  const minutes = Math.max(1, Math.round(median / 60));
  return { minutes, measured: true, sampleSize: Math.round(sampleSize) };
}

/**
 * The line beside the Apply button and at the top of the apply form. One
 * sentence, no exclamation marks, no countdown — cost, prerequisite, and the
 * fact that stopping halfway is safe.
 */
export function applyEffortLine(effort: ApplyEffort, steps: number): string {
  const time = effort.measured
    ? `takes about ${effort.minutes} ${effort.minutes === 1 ? "minute" : "minutes"}`
    : `usually takes under ${effort.minutes + 2} minutes`;
  return `${steps} steps, ${time}. You'll need your CV as a PDF. Your answers are saved as you go.`;
}

/** Where the figure came from, for anyone who wants to know. */
export function applyEffortProvenance(effort: ApplyEffort): string {
  return effort.measured
    ? `Median of ${effort.sampleSize} completed applications for this role.`
    : "Typical across all roles — this posting doesn't have enough completed applications yet to time it.";
}

/**
 * The steps of the apply form, shared so the job page's "how many steps"
 * promise cannot drift from the form that delivers them.
 */
export const APPLY_STEP_LABELS = [
  "Your details",
  "CV upload",
  "Screening",
  "Consent & review",
  "Submit",
] as const;

export const APPLY_STEPS = APPLY_STEP_LABELS.length;
