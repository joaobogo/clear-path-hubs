/**
 * The offer, in one object (redesign "The Run", config/offer.ts).
 *
 * New components read prices, promises and counts from here and nowhere
 * else. It holds no numbers of its own: every value comes from the file that
 * already owns it, so the old pages and the rebuilt ones can never disagree.
 *
 *   prices and packages  pricing-core.ts
 *   seats and support    pricing-entitlements.ts (mirrored below, test-pinned)
 *   timing and size      offer-facts.ts
 *   agency comparison    public-pricing.ts
 *   channels             channel-agents.ts
 *   proof figures        case-study-metrics.ts, only those with a recorded source
 */
import {
  MAX_POSITIONS,
  PACKAGE_10,
  PACKAGE_100,
  PACKAGE_20,
  PACKAGE_30,
  PACKAGE_40,
  PRICE_PILOT_USD,
  formatUsdExact,
} from "@/config/pricing-core";
import { FIRST_SHORTLIST_BUSINESS_DAYS, SHORTLIST_SIZE } from "@/config/offer-facts";
import { CALCULATOR_DEFAULTS } from "@/config/public-pricing";
import { CHANNEL_AGENT_COUNT } from "@/config/channel-agents";
import { publishableMetrics } from "@/config/case-study-metrics";

export type OfferPackage = {
  roles: number;
  price: number;
  seats?: number;
  support?: "Standard" | "Priority";
};

export const offer = {
  pilot: {
    price: PRICE_PILOT_USD,
    roles: 1,
    candidates: SHORTLIST_SIZE,
    businessDays: FIRST_SHORTLIST_BUSINESS_DAYS,
    seats: 2,
    oncePerCompany: true,
  },
  packages: [
    { roles: PACKAGE_10.capacity, price: PACKAGE_10.totalUsd, seats: 4, support: "Standard" },
    { roles: PACKAGE_20.capacity, price: PACKAGE_20.totalUsd, seats: 8, support: "Priority" },
    { roles: PACKAGE_30.capacity, price: PACKAGE_30.totalUsd, seats: 11, support: "Priority" },
    { roles: PACKAGE_40.capacity, price: PACKAGE_40.totalUsd },
    { roles: PACKAGE_100.capacity, price: PACKAGE_100.totalUsd },
  ] as readonly OfferPackage[],
  maxRoles: MAX_POSITIONS,
  accessMonths: 3,
  /** Stated beside every comparison. */
  agencyFee: CALCULATOR_DEFAULTS.agencyFeePct,
  channels: CHANNEL_AGENT_COUNT,
  steps: ["Brief", "Broadcast", "Score", "Sign-off"] as const,
  /**
   * Proof figures that may be published: only those with a recorded source.
   * Empty until the owner records how each one is measured.
   */
  proof: publishableMetrics(),
  proofLabel: "representative",
} as const;

/** "$699". */
export const pilotPriceLabel = formatUsdExact(offer.pilot.price);

/** The one primary button label on the marketing site. */
export const START_PILOT_LABEL = `Start a ${pilotPriceLabel} pilot`;

/** "Usually 5 business days from an approved brief." */
export const PROMISE_SHORT = `${offer.pilot.businessDays} business days from an approved brief`;
