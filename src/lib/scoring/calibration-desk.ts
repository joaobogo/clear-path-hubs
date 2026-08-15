/**
 * Calibration desk math (Wave 4, prompt 12).
 *
 * The existing `calibration-signal.ts` answers "does the scale separate good
 * from bad at all?". This module answers the operator's follow-up questions:
 *
 *   - What actually happened to scored candidates — approvals, interviews
 *     held, offers, hires, declines and the reasons given?
 *   - Where does the live score distribution sit relative to the band
 *     boundaries the product promises? A compressed range (today 40–67, with
 *     nothing above 70) has to be visible at a glance, not inferred.
 *   - Does any position or role family drift away from the platform median?
 *   - Which bands have never been produced, and which are produced but never
 *     convert?
 *
 * Pure functions over already-loaded rows: no DB access, no formatting
 * decisions, fully unit-testable. Every figure carries its own denominator so
 * a surface can never render a rate without the sample behind it.
 */
import { SCORE_BAND_DEFS, type ScoreBand } from "@/config/scoring-bands";
import { REJECTION_REASONS } from "@/lib/client-decision-reasons";
import { bucketScores, MIN_OUTCOMES_FOR_CONFIDENCE, type ScoreBucket } from "./calibration-signal";

/** Minimum rows before a per-position / per-role-family drift line is shown. */
export const MIN_ROWS_FOR_SEGMENT = 3;

/**
 * One scored candidate as the desk sees it. Outcomes are booleans rather than
 * a single enum because they are not mutually exclusive: a hire was also
 * approved, interviewed and offered, and the funnel has to reflect that.
 */
export type DeskRow = {
  match_id: string;
  final_score: number;
  position_id: string | null;
  position_title: string | null;
  role_family: string | null;
  /** Client moved the candidate forward (shortlist, interview, offer, hire). */
  approved: boolean;
  /** An interview actually took place — `interviews.status = 'completed'`. */
  interview_held: boolean;
  offered: boolean;
  hired: boolean;
  declined: boolean;
  /** Structured reason code on the decline, when one was recorded. */
  decline_reason_code: string | null;
};

export type OutcomeFunnel = {
  scored: number;
  approved: number;
  interviews_held: number;
  offered: number;
  hired: number;
  declined: number;
  /** Scored candidates with no client decision and no interview yet. */
  awaiting_decision: number;
};

export type DeclineReasonCount = {
  code: string;
  label: string;
  count: number;
  /** Share of all declines that carry this reason, 0–1. */
  share: number;
  mean_score: number | null;
};

export type BandPerformance = {
  band: ScoreBand;
  label: string;
  min: number;
  max: number;
  produced_count: number;
  approved_count: number;
  hired_count: number;
  declined_count: number;
  /** approved / produced, null when the band has never been produced. */
  approval_rate: number | null;
  /** True when no live score has ever landed in this band. */
  never_produced: boolean;
  /**
   * True when the band has candidates but none of them ever moved forward.
   * Only meaningful once the band has enough rows to mean something, so the
   * flag stays false below MIN_ROWS_FOR_SEGMENT.
   */
  never_converts: boolean;
  note: string;
};

export type SegmentDrift = {
  key: string;
  label: string;
  count: number;
  median_score: number | null;
  /** median_score minus the platform median. Negative = scores lower here. */
  drift: number | null;
  approved: number;
  hired: number;
  approval_rate: number | null;
  bands_used: ScoreBand[];
  note: string;
};

export type RangeCompression = {
  observed_min: number | null;
  observed_max: number | null;
  observed_median: number | null;
  /** Width of the live range as a share of the 0–100 scale, 0–1. */
  used_share: number | null;
  /** Highest band boundary the live maximum actually reaches. */
  highest_band_reached: ScoreBand | null;
  /** Bands sitting entirely above the live maximum. */
  unreachable_bands: ScoreBand[];
  compressed: boolean;
  headline: string;
};

export type CalibrationDesk = {
  total_scored: number;
  funnel: OutcomeFunnel;
  buckets: ScoreBucket[];
  band_boundaries: { band: ScoreBand; label: string; min: number; max: number }[];
  range: RangeCompression;
  band_performance: BandPerformance[];
  decline_reasons: DeclineReasonCount[];
  by_position: SegmentDrift[];
  by_role_family: SegmentDrift[];
  /** Segments hidden because they fall under MIN_ROWS_FOR_SEGMENT. */
  hidden_positions: number;
  hidden_role_families: number;
  coverage_warning: string | null;
};

const REASON_LABELS = new Map(REJECTION_REASONS.map((r) => [r.code as string, r.label as string]));

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function bandOf(score: number): (typeof SCORE_BAND_DEFS)[number] | null {
  return SCORE_BAND_DEFS.find((d) => score >= d.min && score <= d.max) ?? null;
}

function buildFunnel(rows: DeskRow[]): OutcomeFunnel {
  return {
    scored: rows.length,
    approved: rows.filter((r) => r.approved).length,
    interviews_held: rows.filter((r) => r.interview_held).length,
    offered: rows.filter((r) => r.offered).length,
    hired: rows.filter((r) => r.hired).length,
    declined: rows.filter((r) => r.declined).length,
    awaiting_decision: rows.filter(
      (r) => !r.approved && !r.declined && !r.interview_held && !r.offered && !r.hired,
    ).length,
  };
}

function buildDeclineReasons(rows: DeskRow[]): DeclineReasonCount[] {
  const declines = rows.filter((r) => r.declined);
  const groups = new Map<string, number[]>();
  for (const row of declines) {
    const code = row.decline_reason_code ?? "unspecified";
    const list = groups.get(code) ?? [];
    list.push(row.final_score);
    groups.set(code, list);
  }
  return [...groups.entries()]
    .map(([code, scores]) => ({
      code,
      label:
        code === "unspecified"
          ? "No reason recorded"
          : (REASON_LABELS.get(code) ?? code.replace(/_/g, " ")),
      count: scores.length,
      share: declines.length ? scores.length / declines.length : 0,
      mean_score: mean(scores),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildBandPerformance(rows: DeskRow[]): BandPerformance[] {
  return SCORE_BAND_DEFS.map((def) => {
    const inBand = rows.filter((r) => r.final_score >= def.min && r.final_score <= def.max);
    const approved = inBand.filter((r) => r.approved).length;
    const hired = inBand.filter((r) => r.hired).length;
    const declined = inBand.filter((r) => r.declined).length;
    const neverProduced = inBand.length === 0;
    const neverConverts =
      !neverProduced && approved === 0 && inBand.length >= MIN_ROWS_FOR_SEGMENT;
    const note = neverProduced
      ? "Never produced — no live score has landed in this band."
      : neverConverts
        ? `${inBand.length} candidates scored here and none were moved forward.`
        : inBand.length < MIN_ROWS_FOR_SEGMENT
          ? `Only ${inBand.length} candidate${inBand.length === 1 ? "" : "s"} — too few to read.`
          : `${approved} of ${inBand.length} moved forward.`;
    return {
      band: def.key,
      label: def.label,
      min: def.min,
      max: def.max,
      produced_count: inBand.length,
      approved_count: approved,
      hired_count: hired,
      declined_count: declined,
      approval_rate: inBand.length ? approved / inBand.length : null,
      never_produced: neverProduced,
      never_converts: neverConverts,
      note,
    };
  });
}

function buildSegments(
  rows: DeskRow[],
  keyOf: (row: DeskRow) => { key: string; label: string } | null,
  platformMedian: number | null,
): { segments: SegmentDrift[]; hidden: number } {
  const groups = new Map<string, { label: string; rows: DeskRow[] }>();
  for (const row of rows) {
    const k = keyOf(row);
    if (!k) continue;
    const g = groups.get(k.key) ?? { label: k.label, rows: [] };
    g.rows.push(row);
    groups.set(k.key, g);
  }

  let hidden = 0;
  const segments: SegmentDrift[] = [];
  for (const [key, group] of groups) {
    if (group.rows.length < MIN_ROWS_FOR_SEGMENT) {
      hidden += 1;
      continue;
    }
    const scores = group.rows.map((r) => r.final_score);
    const med = median(scores);
    const approved = group.rows.filter((r) => r.approved).length;
    const hired = group.rows.filter((r) => r.hired).length;
    const drift = med !== null && platformMedian !== null ? med - platformMedian : null;
    const bands = [
      ...new Set(
        group.rows
          .map((r) => bandOf(r.final_score)?.key)
          .filter((b): b is ScoreBand => Boolean(b)),
      ),
    ];
    const note =
      drift === null
        ? "No median to compare."
        : Math.abs(drift) < 3
          ? "In line with the platform median."
          : drift > 0
            ? `Scores run ${drift.toFixed(1)} points higher than the platform median.`
            : `Scores run ${Math.abs(drift).toFixed(1)} points lower than the platform median.`;
    segments.push({
      key,
      label: group.label,
      count: group.rows.length,
      median_score: med,
      drift,
      approved,
      hired,
      approval_rate: group.rows.length ? approved / group.rows.length : null,
      bands_used: bands,
      note,
    });
  }
  segments.sort((a, b) => Math.abs(b.drift ?? 0) - Math.abs(a.drift ?? 0) || b.count - a.count);
  return { segments, hidden };
}

function buildRange(rows: DeskRow[]): RangeCompression {
  const scores = rows.map((r) => r.final_score).filter((s) => Number.isFinite(s));
  if (!scores.length) {
    return {
      observed_min: null,
      observed_max: null,
      observed_median: null,
      used_share: null,
      highest_band_reached: null,
      unreachable_bands: [],
      compressed: false,
      headline: "No completed scores yet — nothing to calibrate against.",
    };
  }
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const usedShare = (max - min) / 100;
  const highest = bandOf(max);
  const unreachable = SCORE_BAND_DEFS.filter((d) => d.min > max).map((d) => d.key);
  // Bands are 15–25 points wide, so a live range narrower than a quarter of
  // the scale means most band labels are decorative rather than reachable.
  const compressed = usedShare < 0.25 || unreachable.length > 0;
  const headline = compressed
    ? `Live scores span ${min.toFixed(1)}–${max.toFixed(1)}, using ${(usedShare * 100).toFixed(0)}% of the scale. ${
        unreachable.length
          ? `${unreachable.length} band${unreachable.length === 1 ? "" : "s"} sit entirely above the highest score ever produced.`
          : "The band labels above this range have never been reachable."
      }`
    : `Live scores span ${min.toFixed(1)}–${max.toFixed(1)}, using ${(usedShare * 100).toFixed(0)}% of the scale.`;
  return {
    observed_min: min,
    observed_max: max,
    observed_median: median(scores),
    used_share: usedShare,
    highest_band_reached: highest?.key ?? null,
    unreachable_bands: unreachable,
    compressed,
    headline,
  };
}

export function computeCalibrationDesk(rows: DeskRow[]): CalibrationDesk {
  const scores = rows.map((r) => r.final_score).filter((s) => Number.isFinite(s));
  const platformMedian = median(scores);
  const funnel = buildFunnel(rows);
  const decided = funnel.approved + funnel.declined;

  const positions = buildSegments(
    rows,
    (r) =>
      r.position_id
        ? { key: r.position_id, label: r.position_title ?? "Untitled position" }
        : null,
    platformMedian,
  );
  const families = buildSegments(
    rows,
    (r) => (r.role_family ? { key: r.role_family, label: r.role_family } : null),
    platformMedian,
  );

  return {
    total_scored: rows.length,
    funnel,
    buckets: bucketScores(scores),
    band_boundaries: SCORE_BAND_DEFS.map((d) => ({
      band: d.key,
      label: d.label,
      min: d.min,
      max: d.max,
    })),
    range: buildRange(rows),
    band_performance: buildBandPerformance(rows),
    decline_reasons: buildDeclineReasons(rows),
    by_position: positions.segments,
    by_role_family: families.segments,
    hidden_positions: positions.hidden,
    hidden_role_families: families.hidden,
    coverage_warning:
      decided < MIN_OUTCOMES_FOR_CONFIDENCE
        ? `Only ${decided} scored candidate${decided === 1 ? "" : "s"} ${decided === 1 ? "has" : "have"} an approval or decline on record (need ${MIN_OUTCOMES_FOR_CONFIDENCE}+ before drift figures mean anything). Read everything below as directional.`
        : null,
  };
}
