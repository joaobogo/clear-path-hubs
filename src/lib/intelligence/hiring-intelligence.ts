/**
 * Hiring Intelligence — pure layer.
 *
 * RULES (do not relax):
 *  - No metric is ever invented, estimated, benchmarked or smoothed. If the
 *    records needed for an answer do not exist, the metric reports its state
 *    and says why.
 *  - Every metric answers a decision question. A metric with no decision
 *    question does not belong here.
 *  - Six honest states: ok, partial, insufficient, no_data, stale, error.
 *
 * Safe on both server and client (no imports beyond config).
 */

import { classifyScoreBand, SCORE_BAND_DEFS } from "@/config/scoring-bands";
import { APP_LOCALE } from "@/lib/format/datetime";

export const DAY_MS = 86_400_000;

/** Minimum observations before a median or distribution is shown at all. */
export const MIN_SAMPLE_MEDIAN = 3;
/** Minimum observations before a distribution is shown as a chart. */
export const MIN_SAMPLE_DISTRIBUTION = 5;
/** A metric goes stale when its newest underlying record is older than this. */
export const DEFAULT_STALE_AFTER_DAYS = 14;

export type MetricStatus =
  | "ok"
  | "partial"
  | "insufficient"
  | "no_data"
  | "stale"
  | "error";

export type MetricTone = "good" | "warn" | "bad" | "neutral";

/** One plotted observation. `tone` never carries meaning alone — `note` does. */
export type MetricPoint = {
  key: string;
  label: string;
  value: number;
  /** Secondary value for paired bars (e.g. promised vs actual). */
  compareValue?: number | null;
  tone?: MetricTone;
  /** Plain-language detail, also used as the table cell and tooltip text. */
  note?: string | null;
};

export type MetricChart = {
  kind: "bars" | "paired-bars" | "funnel" | "distribution";
  /** Axis unit, e.g. "candidates", "days", "%". */
  unit: string;
  points: MetricPoint[];
  /** Explicit total for the chart heading. Defaults to the sum of points. */
  total?: number;
  /** Column headings for the accessible table fallback. */
  valueHeading: string;
  compareHeading?: string;
};

export type MetricComparison = {
  /** e.g. "previous 90 days". */
  baselineLabel: string;
  baselineValue: string | null;
  /** Signed, already-formatted change, e.g. "+2.4 days". Null when unknown. */
  delta: string | null;
  direction: "up" | "down" | "flat" | "unknown";
  tone: MetricTone;
};

export type MetricLink = {
  label: string;
  to: string;
  search?: Record<string, string>;
};

export type MetricFreshness = {
  /** Timestamp of the newest record behind this metric. */
  latestAt: string | null;
  computedAt: string;
  staleAfterDays: number;
};

export type IntelligenceMetric = {
  key: string;
  title: string;
  /** The decision this metric exists to serve. */
  question: string;
  status: MetricStatus;
  /** Why the status is not "ok". Always present unless status is "ok". */
  statusReason: string | null;
  value: string | null;
  valueNote: string | null;
  tone: MetricTone;
  comparison: MetricComparison | null;
  freshness: MetricFreshness;
  /** What the number means, in plain language, grounded in the records used. */
  explanation: string;
  /** Only when the data supports a specific next move. */
  action: { label: string; detail: string; link: MetricLink | null } | null;
  link: MetricLink | null;
  chart: MetricChart | null;
  /** Sample the metric was computed from, so partial data is visible. */
  sample: { counted: number; expected: number | null; unit: string } | null;
};

// ── State resolution ─────────────────────────────────────────────────────────

export function isStale(
  latestAt: string | null,
  staleAfterDays: number,
  now: Date = new Date(),
): boolean {
  if (!latestAt) return false;
  const t = new Date(latestAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > staleAfterDays * DAY_MS;
}

/**
 * Single decision point for which of the six states a metric is in.
 * Order matters: error > no_data > insufficient > stale > partial > ok.
 */
export function resolveMetricStatus(input: {
  error?: string | null;
  counted: number;
  minSample?: number;
  expected?: number | null;
  latestAt?: string | null;
  staleAfterDays?: number;
  now?: Date;
}): { status: MetricStatus; reason: string | null } {
  const {
    error,
    counted,
    minSample = 1,
    expected = null,
    latestAt = null,
    staleAfterDays = DEFAULT_STALE_AFTER_DAYS,
    now = new Date(),
  } = input;

  if (error) return { status: "error", reason: error };
  if (counted <= 0)
    return {
      status: "no_data",
      reason: "No records behind this measure yet.",
    };
  if (counted < minSample)
    return {
      status: "insufficient",
      reason: `Only ${counted} of the ${minSample} records needed for a reliable read. Shown as a count, not a trend.`,
    };
  if (isStale(latestAt, staleAfterDays, now))
    return {
      status: "stale",
      reason: `Newest record is ${daysAgo(latestAt, now)} days old. Treat this as a historical figure.`,
    };
  if (expected !== null && counted < expected)
    return {
      status: "partial",
      reason: `Computed from ${counted} of ${expected} records — the rest have no data to measure yet.`,
    };
  return { status: "ok", reason: null };
}

export function daysAgo(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function freshnessLabel(
  f: MetricFreshness,
  now: Date = new Date(),
): string {
  if (!f.latestAt) return "No source record yet";
  const d = daysAgo(f.latestAt, now);
  if (d === null) return "Source date unreadable";
  if (d === 0) return "Newest record: today";
  if (d === 1) return "Newest record: yesterday";
  return `Newest record: ${d} days ago`;
}

// ── Math (no estimation) ─────────────────────────────────────────────────────

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compare two measured values. Returns `unknown` when either side is missing —
 * we never fill a baseline in.
 */
export function compare(
  current: number | null,
  baseline: number | null,
  opts: { lowerIsBetter?: boolean; unit?: string; digits?: number } = {},
): Omit<MetricComparison, "baselineLabel"> {

  const { lowerIsBetter = false, unit = "", digits = 1 } = opts;
  const fmt = (v: number) => `${v.toFixed(digits).replace(/\.0$/, "")}${unit ? ` ${unit}` : ""}`;
  if (current === null || baseline === null) {
    return {
      baselineValue: baseline === null ? null : fmt(baseline),
      delta: null,
      direction: "unknown",
      tone: "neutral",
    };
  }
  const diff = current - baseline;
  const rounded = Number(diff.toFixed(digits));
  if (rounded === 0) {
    return { baselineValue: fmt(baseline), delta: "no change", direction: "flat", tone: "neutral" };
  }
  const better = lowerIsBetter ? rounded < 0 : rounded > 0;
  return {
    baselineValue: fmt(baseline),
    delta: `${rounded > 0 ? "+" : "−"}${fmt(Math.abs(rounded))}`,
    direction: rounded > 0 ? "up" : "down",
    tone: better ? "good" : "bad",
  };
}

/** Score distribution across the canonical bands. Counts only, no smoothing. */
export function bucketScores(scores: number[]): MetricPoint[] {
  const buckets = new Map<string, number>();
  for (const s of scores) {
    const band = classifyScoreBand(s);
    buckets.set(band.key, (buckets.get(band.key) ?? 0) + 1);
  }
  return SCORE_BAND_DEFS.map((def) => ({
    key: def.key,
    label: def.shortLabel,
    value: buckets.get(def.key) ?? 0,
    tone:
      def.key === "exceptional" || def.key === "top"
        ? ("good" as MetricTone)
        : def.key === "not_recommended"
          ? ("bad" as MetricTone)
          : ("neutral" as MetricTone),
    note: `${buckets.get(def.key) ?? 0} scored ${def.min}–${def.max}`,
  }));
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function daysLabel(v: number | null, digits = 1): string {
  if (v === null) return "—";
  const rounded = Number(v.toFixed(digits));
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

// ── Representative view (public/marketing use only) ──────────────────────────

/**
 * A visibly-labelled representative set. Never mixed into a workspace read:
 * the workspace renders live records or an honest empty state.
 */
export const REPRESENTATIVE_NOTICE =
  "Representative data — a worked example, not a live workspace.";
