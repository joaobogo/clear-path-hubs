/**
 * TaaSFlow — Canonical price rule (single source of truth)
 * ========================================================
 * WE SELL PACKAGES, NOT POSITIONS.
 *
 * Each package states a capacity ("up to N positions") and one total price:
 *   • Pilot                    → 1 position, one time only, $699
 *   • Up to 10 positions       → $8,000
 *   • Up to 20 positions       → $15,200
 *   • Up to 30 positions       → $21,600
 *   • More than 30 positions   → no price shown; the CTA is to talk to us
 *
 * DERIVATION (internal reasoning only — never rendered):
 * the three package totals are capacity × $800 base, less a volume discount of
 * 0%, 5% and 10% respectively. The per-position figure is how we work the
 * number out; it is never shown to a customer, never printed on a card, never
 * written in a caption and never used as a unit anywhere on the site.
 *
 * Subscriptions use exactly the same three packages at exactly the same
 * prices, billed monthly instead of once. There is no annual discount: a
 * second, lower total would contradict one package having one price.
 *
 * Never render a price preceded by "From", never describe a package as a range
 * between two counts, and never publish a per-position figure.
 */

/** Flat pilot fee — one position, one time only. */
export const PRICE_PILOT_USD = 699;

/** Internal base rate used to derive package totals. Never rendered. */
export const BASE_RATE_PER_POSITION_USD = 800;

/** Hard maximum. Above this we show no price and the CTA is to talk to us. */
export const MAX_POSITIONS = 30;

/** Internal derivation inputs: capacity + volume discount. Never rendered. */
export const PACKAGE_DERIVATION = [
  { id: "growth", capacity: 10, volumeDiscount: 0 },
  { id: "scale", capacity: 20, volumeDiscount: 0.05 },
  { id: "volume", capacity: 30, volumeDiscount: 0.1 },
] as const;

export type PackageId = "pilot" | "growth" | "scale" | "volume";

/** USD, exact, no rounding and no abbreviation. */
export function formatUsdExact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Internal: total for a capacity from the base rate and its volume discount. */
function derivePackageTotal(capacity: number, volumeDiscount: number): number {
  return Math.round(capacity * BASE_RATE_PER_POSITION_USD * (1 - volumeDiscount));
}

export type PricingPackageCore = {
  id: PackageId;
  /** Positions included in the package. */
  capacity: number;
  /** The one total price. Billed once, or monthly on a subscription. */
  totalUsd: number;
  /** Exact total as a display string. */
  totalDisplay: string;
  /** Capacity sentence — always "up to" and a single number. */
  capacityLabel: string;
};

export const PILOT_ROLES_LABEL = "1 position";

/** The four published packages, in order. */
export const PACKAGES: readonly PricingPackageCore[] = [
  {
    id: "pilot",
    capacity: 1,
    totalUsd: PRICE_PILOT_USD,
    totalDisplay: formatUsdExact(PRICE_PILOT_USD),
    capacityLabel: PILOT_ROLES_LABEL,
  },
  ...PACKAGE_DERIVATION.map((d) => {
    const totalUsd = derivePackageTotal(d.capacity, d.volumeDiscount);
    return {
      id: d.id as PackageId,
      capacity: d.capacity,
      totalUsd,
      totalDisplay: formatUsdExact(totalUsd),
      capacityLabel: `Up to ${d.capacity} positions`,
    };
  }),
] as const;

export const PILOT_PACKAGE = PACKAGES[0]!;
export const PACKAGE_10 = PACKAGES[1]!;
export const PACKAGE_20 = PACKAGES[2]!;
export const PACKAGE_30 = PACKAGES[3]!;

export const PRICE_PILOT_DISPLAY = PILOT_PACKAGE.totalDisplay;

/** Above the maximum: no price, talk to us. */
export const ABOVE_MAX_DISPLAY = "Talk to us";
export const ABOVE_MAX_CTA_LABEL = "Talk to us";
export const ABOVE_MAX_ROLES_LABEL = `More than ${MAX_POSITIONS} positions`;

/**
 * THE function. The package that covers `positions`, or null when no price is
 * shown (0, non-integer, or above the maximum). Anywhere the product needs to
 * know which package someone falls into, it asks this.
 */
export function packageForPositions(positions: number): PricingPackageCore | null {
  if (!Number.isInteger(positions) || positions < 1) return null;
  return PACKAGES.find((p) => positions <= p.capacity) ?? null;
}

/** The one total for a position count — the covering package's total. */
export function positionsTotalUsd(positions: number): number | null {
  return packageForPositions(positions)?.totalUsd ?? null;
}

/** Exact total as a display string, or the talk-to-us label above the maximum. */
export function positionsTotalDisplay(positions: number): string {
  const pkg = packageForPositions(positions);
  return pkg ? pkg.totalDisplay : ABOVE_MAX_DISPLAY;
}

/** Capacity sentence for a position count, or the talk-to-us label. */
export function positionsCapacityLabel(positions: number): string {
  return packageForPositions(positions)?.capacityLabel ?? ABOVE_MAX_ROLES_LABEL;
}

/** Reference package used for ROI comparisons. */
export const ROI_REFERENCE_POSITIONS = PACKAGE_10.capacity;
export const ROI_REFERENCE_PACKAGE_USD = PACKAGE_10.totalUsd;
export const ROI_REFERENCE_PACKAGE_LABEL = PACKAGE_10.capacityLabel;

/** Turnaround guarantee shared across every published package. */
export const TURNAROUND_LABEL = "5-day turnaround";

/** One package, one price — billed once or monthly. No annual discount. */
export const NO_DISCOUNT_NOTE =
  "One package, one price — billed once or monthly, with no annual discount.";
