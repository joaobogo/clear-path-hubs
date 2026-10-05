import { PRICE_PILOT_DISPLAY, PRICE_PILOT_USD } from "@/config/pricing-core";

/**
 * Canonical public commercial promises.
 *
 * Keep customer-facing timelines, deliverables, guarantees and response
 * expectations here so marketing, pricing, pilot and machine-readable pages
 * cannot drift apart.
 */
export const PILOT = {
  priceUsd: PRICE_PILOT_USD,
  priceDisplay: PRICE_PILOT_DISPLAY,
  roles: 1,
  onePerCompany: true,
  durationDays: 15,
  guaranteedCandidates: 10,
  firstTopTenBusinessDays: 5,
  fullMarketViewDays: 15,
  rerunScoreThreshold: 90,
} as const;

export const PILOT_HEADLINE = "Give us the role. Get your top 10." as const;

export const PILOT_TIMELINE_LINE =
  "Your first ranked top 10 in 5 business days. Your full, scored market view by day 15." as const;

export const PILOT_GUARANTEE =
  "If none of the top 10 scores above 90 against the role criteria you approved, we rerun the search at no cost." as const;

export const PILOT_OWNERSHIP =
  "The candidates sourced for your role are yours to keep and reuse. We do not recycle that client pipeline to another client." as const;

export const PILOT_SCOPE_NOTE =
  "The rerun guarantee applies to the agreed role criteria and scoring rubric. A change in preference after delivery does not invalidate a matching shortlist." as const;

export const LEAD_RESPONSE = {
  promisedHours: 4,
  typicalHours: 1,
  promise: "Expect to hear from us within 4 hours — usually within 1 hour.",
} as const;

export const PUBLIC_POSITIONING =
  "Flat-fee recruiting run by AI agents and senior recruiters." as const;

export const PUBLIC_MECHANISM =
  "We run multi-channel sourcing and outreach, score candidates against your approved criteria, and deliver the evidence in your workspace." as const;
