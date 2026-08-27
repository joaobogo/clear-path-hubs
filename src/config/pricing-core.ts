/**
 * TaaSFlow — Canonical price rule (single source of truth)
 * ========================================================
 * THE RULE — there is no other one:
 *   • 1 position                → flat $699 pilot
 *   • 2–10 positions            → $900 per position
 *   • 11–20 positions           → $850 per position
 *   • 21–30 positions           → $800 per position
 *   • more than 30 positions    → no price shown, the CTA is to talk to us
 *
 * The rate is set by the TOTAL number of positions and applies to all of them,
 * so 12 positions = 12 × $850 = $10,200.
 *
 * Monotonic guard: the total must never fall as the count rises. Where a band
 * boundary would produce a lower total (20 × $850 = $17,000 vs 21 × $800 =
 * $16,800), the total is held at the previous maximum until the new rate
 * overtakes it — so 21 positions is also $17,000 and 22 is $17,600.
 *
 * Every price rendered or charged anywhere reads `positionsTotalUsd()` from
 * this file. Never hard-code a price, a band as a price, or the word "From".
 *
 * One-off and subscription use the same rates.
 */

/** Flat pilot fee for a single position. */
export const PRICE_PILOT_USD = 699;

/** Hard maximum. Above this we show no price and the CTA is to talk to us. */
export const MAX_POSITIONS = 30;

/** Per-position rates by total position count. */
export const POSITION_RATE_BANDS = [
  { id: "growth", min: 2, max: 10, rateUsd: 900 },
  { id: "scale", min: 11, max: 20, rateUsd: 850 },
  { id: "volume", min: 21, max: 30, rateUsd: 800 },
] as const;

export type PositionRateBand = (typeof POSITION_RATE_BANDS)[number];

/** USD, exact, no rounding and no abbreviation. */
export function formatUsdExact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** The per-position rate for a total count, or null outside 2–30. */
export function positionRateUsd(positions: number): number | null {
  if (!Number.isInteger(positions)) return null;
  const band = POSITION_RATE_BANDS.find(
    (b) => positions >= b.min && positions <= b.max,
  );
  return band ? band.rateUsd : null;
}

/** Raw total before the monotonic guard. */
function rawTotalUsd(positions: number): number | null {
  if (positions === 1) return PRICE_PILOT_USD;
  const rate = positionRateUsd(positions);
  return rate === null ? null : rate * positions;
}

/**
 * THE function. Exact final total for `positions`, including the monotonic
 * guard. Returns null when no price is shown (0, non-integer, or above 30).
 */
export function positionsTotalUsd(positions: number): number | null {
  if (!Number.isInteger(positions) || positions < 1 || positions > MAX_POSITIONS)
    return null;
  let best = 0;
  for (let n = 1; n <= positions; n += 1) {
    const raw = rawTotalUsd(n);
    if (raw !== null && raw > best) best = raw;
  }
  return best;
}

/** Exact total as a display string, or the talk-to-us label above the maximum. */
export function positionsTotalDisplay(positions: number): string {
  const total = positionsTotalUsd(positions);
  return total === null ? ABOVE_MAX_DISPLAY : formatUsdExact(total);
}

/** Rate as a display string for a band (never a range, never "From"). */
export function rateDisplay(rateUsd: number): string {
  return formatUsdExact(rateUsd);
}

export const PRICE_PILOT_DISPLAY = formatUsdExact(PRICE_PILOT_USD);
export const PER_POSITION_SUFFIX = "per position";

/** Above the maximum: no price, talk to us. */
export const ABOVE_MAX_DISPLAY = "Talk to us";
export const ABOVE_MAX_CTA_LABEL = "Talk to us";
export const ABOVE_MAX_ROLES_LABEL = `More than ${MAX_POSITIONS} positions`;

/** Band descriptors — one source for tier subtitles/eyebrows. */
export const PILOT_ROLES_LABEL = "1 position";
export const GROWTH_ROLES_LABEL = "2–10 positions";
export const SCALE_ROLES_LABEL = "11–20 positions";
export const VOLUME_ROLES_LABEL = "21–30 positions";

export const GROWTH_RATE_USD = POSITION_RATE_BANDS[0].rateUsd;
export const SCALE_RATE_USD = POSITION_RATE_BANDS[1].rateUsd;
export const VOLUME_RATE_USD = POSITION_RATE_BANDS[2].rateUsd;
export const GROWTH_RATE_DISPLAY = rateDisplay(GROWTH_RATE_USD);
export const SCALE_RATE_DISPLAY = rateDisplay(SCALE_RATE_USD);
export const VOLUME_RATE_DISPLAY = rateDisplay(VOLUME_RATE_USD);

/** Position-band boundaries (display and selector use only — never pricing). */
export const POSITION_BANDS = {
  pilot: { min: 1, max: 1 },
  growth: { min: POSITION_RATE_BANDS[0].min, max: POSITION_RATE_BANDS[0].max },
  scale: { min: POSITION_RATE_BANDS[1].min, max: POSITION_RATE_BANDS[1].max },
  volume: { min: POSITION_RATE_BANDS[2].min, max: POSITION_RATE_BANDS[2].max },
  aboveMax: { min: MAX_POSITIONS + 1, max: null as number | null },
} as const;

/** Three positions is the reference basket used for ROI comparisons. */
export const ROI_REFERENCE_POSITIONS = 3;
export const ROI_REFERENCE_PACKAGE_USD = positionsTotalUsd(
  ROI_REFERENCE_POSITIONS,
)!;
export const ROI_REFERENCE_PACKAGE_LABEL = `${ROI_REFERENCE_POSITIONS} positions at ${GROWTH_RATE_DISPLAY} each`;

/** Turnaround guarantee shared across every published tier. */
export const TURNAROUND_LABEL = "5-day turnaround";

/**
 * There is no annual discount and never a second, lower total: one exact price
 * per position count, whether billed once or monthly.
 */
export const NO_DISCOUNT_NOTE =
  "One exact total per position count — no annual discount, no ranges.";
