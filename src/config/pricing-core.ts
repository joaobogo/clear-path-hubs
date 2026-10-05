/**
 * TaaSFlow — Canonical price rule (single source of truth)
 * ========================================================
 * TWO WAYS TO BUY THE SAME CAPACITY: PREPAID PACKAGES OR SUBSCRIPTION.
 *
 * Each package states a capacity ("up to N positions") and one total price:
 *   • Pilot                    → 1 position, one time only, $699
 *   • Up to 10 positions       → $8,000
 *   • Up to 20 positions       → $15,200
 *   • Up to 30 positions       → $21,600
 *   • Up to 40 positions       → $27,200
 *   • Up to 100 positions      → $64,000
 *   • More than 100 positions  → no price shown; the CTA is to talk to us
 *
 * DERIVATION (internal reasoning only — never rendered):
 * the five package totals are capacity × $800 base, less a volume discount of
 * 0%, 5%, 10%, 15% and 20% respectively. The per-position figure is how we work
 * the number out; it is never shown to a customer, never printed on a card,
 * never written in a caption and never used as a unit anywhere on the site.
 *
 * Prepaid packages are position credits bought up front. A client can activate
 * those positions when they need them instead of opening every role at once;
 * unused position credits can roll over rather than disappearing at year-end.
 *
 * Subscriptions use the same published capacity bands at the same prices, billed
 * monthly. They are continuous recruiting capacity: roles can rotate as hiring
 * priorities change while sourcing, outreach and pipeline-building keep running.
 *
 * Paying twelve subscription months up front takes 10% off the annual total —
 * the one discount we publish. The monthly package total itself never changes.
 *
 * Never render a price preceded by "From", never describe a package as a range
 * between two counts, and never publish a per-position figure.
 */

/** Flat pilot fee — one position, one time only. */
export const PRICE_PILOT_USD = 699;

/** Internal base rate used to derive package totals. Never rendered. */
export const BASE_RATE_PER_POSITION_USD = 800;

/** Hard maximum. Above this we show no price and the CTA is to talk to us. */
export const MAX_POSITIONS = 100;

/** Internal derivation inputs: capacity + volume discount. Never rendered. */
export const PACKAGE_DERIVATION = [
  { id: "growth", capacity: 10, volumeDiscount: 0 },
  { id: "scale", capacity: 20, volumeDiscount: 0.05 },
  { id: "volume", capacity: 30, volumeDiscount: 0.1 },
  { id: "portfolio", capacity: 40, volumeDiscount: 0.15 },
  { id: "program", capacity: 100, volumeDiscount: 0.2 },
] as const;

export type PackageId =
  | "pilot"
  | "growth"
  | "scale"
  | "volume"
  | "portfolio"
  | "program";

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

/** The six published packages, in ascending capacity order. */
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
export const PACKAGE_40 = PACKAGES[4]!;
export const PACKAGE_100 = PACKAGES[5]!;

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
export const TURNAROUND_LABEL = "Top 10 in 5 business days";

/**
 * The one discount we publish: pay twelve months up front, save 10%.
 * The monthly package total itself never changes — the discount applies only to
 * the annual prepayment, so one package still has one price.
 */
export const ANNUAL_DISCOUNT_PCT = 0.1;

/** Rendered percentage, e.g. "10%". */
export const ANNUAL_DISCOUNT_DISPLAY = `${Math.round(ANNUAL_DISCOUNT_PCT * 100)}%`;

/** Public explanation of the prepaid package model. */
export const PREPAID_PACKAGE_NOTE =
  "Buy position credits up front, activate them when you need them, and let unused credits roll over instead of expiring at year-end.";

/** Public explanation of the subscription model. */
export const SUBSCRIPTION_MODEL_NOTE =
  "Continuous recruiting capacity billed monthly: rotate in new roles as priorities change while sourcing and pipeline-building keep running.";

/** Subscription billing note. */
export const ANNUAL_DISCOUNT_NOTE =
  `Subscriptions are billed monthly at the published package price. Pay twelve months up front and save ${ANNUAL_DISCOUNT_DISPLAY}.`;

export type SubscriptionTotals = {
  /** The package total, charged each month. */
  monthly: number;
  /** Twelve monthly totals, before the annual-prepay discount. */
  annualBeforeDiscount: number;
  /** What twelve months cost when paid up front. */
  annual: number;
  /** What the annual prepayment saves. */
  annualSavings: number;
};

/**
 * Subscription totals for a position count, or null above the maximum where no
 * price is published. Every subscription figure on the site comes from here.
 */
export function subscriptionTotalsUsd(positions: number): SubscriptionTotals | null {
  const monthly = positionsTotalUsd(positions);
  if (monthly === null) return null;
  const annualBeforeDiscount = monthly * 12;
  const annual = Math.round(annualBeforeDiscount * (1 - ANNUAL_DISCOUNT_PCT));
  return {
    monthly,
    annualBeforeDiscount,
    annual,
    annualSavings: annualBeforeDiscount - annual,
  };
}
